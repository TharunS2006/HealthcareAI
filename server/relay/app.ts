/**
 * The mesh relay's rules, shared by the local relay (server/mesh-server.ts:
 * one process, websockets, memory) and the hosted one (server/relay/vercel.ts:
 * serverless, HTTP polling, Upstash Redis).
 *
 * The relay forwards referral changes between devices and refuses the ones
 * that break the role rules (lib/auth/permissions.ts, lib/referrals/workflow.ts).
 * Identity is proven, not claimed: staff sign in here with their PIN and every
 * later request carries the signed token this relay issued (./auth.ts). A
 * referral event must be authored by the user who sends it — a signed-in ANM
 * cannot publish an "acceptance" in the Medical Officer's name.
 *
 * @module server/relay/app
 */

import express from 'express';
import type { Server as SocketIO, Socket } from 'socket.io';
import {
    canViewReferral,
    mergeReferral,
    normalizeReferral,
    verifyPublishedReferral,
} from '../../lib/referrals/workflow';
import { can, isDistrictWide, type StaffRole } from '../../lib/auth/permissions';
import { SEED_USERS, type StaffUser } from '../../lib/auth/users';
import { verifyPin } from '../../lib/auth/pin';
import { SEED_REFERRALS } from '../../lib/data/referralSeed';
import type { ReferralRecord } from '../../types/patient';
import type { NotificationRecord } from '../../types/referral';
import type { FacilityResources, MaintenanceTicket } from '../../types/resources';
import { bearer, LOCKOUT_SECONDS, MAX_PIN_FAILURES, signToken, verifyToken } from './auth';
import type { CachedReferral, RelayStore } from './store';
import { AbdmError, normaliseAbhaNumber, type createAbdmClient } from './abha';
import { BhashiniError, isBhashiniLanguage, type createBhashiniClient } from './bhashini';

export interface Identity {
    userId: string;
    role: StaffRole;
    facilityId: string | null;
    name: string;
}

export interface RelayOptions {
    store: RelayStore;
    /** Token signing secret; null disables sign-in (every protected route answers 503). */
    secret: string | null;
    /** Present on the local relay only: forward changes to connected sockets at once. */
    io?: SocketIO;
    /** ABDM sandbox client (./abha.ts); null when ABDM credentials are not configured. */
    abdm?: ReturnType<typeof createAbdmClient> | null;
    /** Bhashini client (./bhashini.ts); null when Bhashini keys are not configured. */
    bhashini?: ReturnType<typeof createBhashiniClient> | null;
    log?: (message: string, data?: object) => void;
}

/**
 * The demo referrals every device starts with. Their events have fixed ids
 * (lib/data/referralSeed.ts) and ship in the app, so the relay treats an event
 * as already known when its id, action and author match — only its time,
 * relative to when each device loaded, differs. A "forged" copy of one can
 * only restate the shipped step.
 */
const SEED_EVENTS = new Map<string, string>();
const SEED_COMMENTS = new Map<string, string>();
const SEED_NOTES = new Map<string, string>();
for (const r of SEED_REFERRALS) {
    for (const e of r.timeline) SEED_EVENTS.set(e.id, `${r.id}|${e.action}|${e.actor.userId}`);
    for (const c of r.comments) SEED_COMMENTS.set(c.id, `${r.id}|${c.actor.userId}|${c.text}`);
    for (const n of r.treatmentNotes ?? []) SEED_NOTES.set(n.id, `${r.id}|${n.actor.userId}|${n.text}`);
}

type Result<T> = { ok: true; value: T } | { ok: false; status: number; reason: string; retry?: boolean };

/** Per ABHA number: OTP requests allowed in a window, and wrong OTPs per transaction. */
const ABHA_OTP_REQUESTS = 5;
const ABHA_OTP_WINDOW_SECONDS = 15 * 60;
const ABHA_VERIFY_ATTEMPTS = 5;

export function createRelay({ store, secret, io, abdm = null, bhashini = null, log = () => undefined }: RelayOptions) {
    // ── identity ─────────────────────────────────────────────────────────────

    /** The directory entry: a Super Admin's change wins over the seeded roster. */
    async function directoryUser(id: string): Promise<StaffUser | undefined> {
        return (await store.getUser(id)) ?? SEED_USERS.find(u => u.id === id);
    }

    /**
     * Who a token belongs to — if it verifies AND the directory still says the
     * same thing. A user deactivated or re-posted since signing in is refused
     * rather than acting under a role they no longer hold.
     */
    async function identify(token: string | null | undefined): Promise<Identity | null> {
        if (!secret || !token) return null;
        const claims = verifyToken(token, secret);
        if (!claims) return null;
        const user = await directoryUser(claims.sub);
        if (!user || !user.active || user.role !== claims.role || (user.facilityId ?? null) !== claims.fac) return null;
        return { userId: claims.sub, role: claims.role, facilityId: claims.fac, name: user.name };
    }

    const fromRequest = (req: express.Request) => identify(bearer(req.header('authorization')));

    async function signIn(body: unknown): Promise<Result<{ token: string; expiresAt: number; user: StaffUser }>> {
        if (!secret) return { ok: false, status: 503, reason: 'Sign-in is not configured on this relay (NALAMMESH_AUTH_SECRET is unset)' };
        const { userId, pin } = (body ?? {}) as { userId?: unknown; pin?: unknown };
        if (typeof userId !== 'string' || typeof pin !== 'string') return { ok: false, status: 400, reason: 'Send userId and pin' };
        if ((await store.pinFailures(userId)) >= MAX_PIN_FAILURES) {
            return { ok: false, status: 423, reason: `Too many wrong PINs — this account is locked for up to ${LOCKOUT_SECONDS / 60} minutes` };
        }
        const user = await directoryUser(userId);
        if (user && user.active && !user.pinHash) {
            return { ok: false, status: 403, reason: 'No PIN has been set for this account — ask the Super Admin to set one' };
        }
        if (!user || !user.active || !(await verifyPin(pin, user.pinHash))) {
            const failures = await store.recordPinFailure(userId, LOCKOUT_SECONDS);
            log('Sign-in refused', { userId, failures });
            if (failures >= MAX_PIN_FAILURES) {
                return { ok: false, status: 423, reason: `Too many wrong PINs — this account is locked for up to ${LOCKOUT_SECONDS / 60} minutes` };
            }
            return { ok: false, status: 401, reason: `Wrong staff member or PIN — ${MAX_PIN_FAILURES - failures} attempt(s) left` };
        }
        await store.clearPinFailures(userId);
        const { token, expiresAt } = signToken({ sub: user.id, role: user.role, fac: user.facilityId ?? null, name: user.name }, secret);
        log('Signed in', { userId: user.id, role: user.role });
        const { pinHash: _hidden, ...publicUser } = user;
        return { ok: true, value: { token, expiresAt, user: publicUser } };
    }

    // ── referrals ────────────────────────────────────────────────────────────

    /** May this user be sent this referral? A receiver also gets it while CREATED, to confirm delivery. */
    function mayReceive(who: Identity, referral: ReferralRecord): boolean {
        if (canViewReferral(who, referral)) return true;
        return referral.status === 'CREATED' && who.facilityId === referral.toFacilityId && can(who.role, 'referral:receive');
    }

    function notificationsFor(who: Identity, rows: NotificationRecord[]): NotificationRecord[] {
        return rows.filter(n => n.recipient_user_id === who.userId || (who.facilityId !== null && n.facility_id === who.facilityId));
    }

    /**
     * Events and comments new to the relay must be the sender's own, or the
     * automatic ones any device may produce. Another user's change travels in
     * their own signed request; one that has not arrived yet is not refused —
     * the sender is told to retry once it has (409).
     */
    function authorshipProblem(known: ReferralRecord | undefined, ref: ReferralRecord, who: Identity): string | null {
        const isSender = (a: { userId: string; role: string; facilityId: string | null }) =>
            a.userId === who.userId && a.role === who.role && (a.facilityId ?? null) === who.facilityId;
        const knownEvents = new Set(known?.timeline.map(e => e.id) ?? []);
        for (const e of ref.timeline) {
            if (knownEvents.has(e.id) || e.actor.role === 'SYSTEM' || isSender(e.actor)) continue;
            if (SEED_EVENTS.get(e.id) === `${ref.id}|${e.action}|${e.actor.userId}`) continue;
            // "Sent" is the creator's step but a fact others observe: the creator's
            // device records it when the relay acknowledges, or the receiving
            // facility's when the referral reaches them. Either may carry it.
            if (e.action === 'SEND' && who.facilityId !== null && who.facilityId === ref.toFacilityId && can(who.role, 'referral:receive')) continue;
            // Pre-lifecycle records rebuilt by normalizeReferral carry these; only on first arrival.
            if (!known && e.actor.userId === 'legacy' && e.id.startsWith(`${ref.id}:legacy:`)) continue;
            return `${e.actor.name}'s ${e.action.toLowerCase()} has not reached the network yet`;
        }
        const knownComments = new Set(known?.comments.map(c => c.id) ?? []);
        for (const c of ref.comments) if (!knownComments.has(c.id) && !isSender(c.actor) && SEED_COMMENTS.get(c.id) !== `${ref.id}|${c.actor.userId}|${c.text}`) return `A comment by ${c.actor.name} has not reached the network yet`;
        const knownNotes = new Set((known?.treatmentNotes ?? []).map(n => n.id));
        for (const n of ref.treatmentNotes ?? []) if (!knownNotes.has(n.id) && !isSender(n.actor) && SEED_NOTES.get(n.id) !== `${ref.id}|${n.actor.userId}|${n.text}`) return `A treatment note by ${n.actor.name} has not reached the network yet`;
        return null;
    }

    async function acceptReferral(payload: unknown, who: Identity | null): Promise<Result<{ entry: CachedReferral; fresh: NotificationRecord[] }>> {
        if (!who) return { ok: false, status: 401, reason: 'Sign in to publish referrals' };
        const body = payload as { referral?: ReferralRecord; notifications?: NotificationRecord[] } | undefined;
        const incoming = body?.referral;
        if (!incoming || typeof incoming.id !== 'string' || !Array.isArray(incoming.timeline)) {
            return { ok: false, status: 400, reason: 'Body must carry a referral with an id and a timeline' };
        }
        return store.withLock(`referral:${incoming.id}`, async () => {
            const known = await store.getReferral(incoming.id);
            const normalized = normalizeReferral(incoming);
            const verdict = verifyPublishedReferral(known?.referral, normalized);
            if (!verdict.ok) return { ok: false, status: 403, reason: verdict.message } as const;
            const problem = authorshipProblem(known?.referral, normalized, who);
            if (problem) return { ok: false, status: 409, reason: problem, retry: true } as const;

            const merged = mergeReferral(known?.referral, normalized);
            const seen = new Set((known?.notifications ?? []).map(n => n.id));
            const fresh = (Array.isArray(body?.notifications) ? body!.notifications : []).filter(n => n && typeof n.id === 'string' && !seen.has(n.id));
            const entry: CachedReferral = { referral: merged, notifications: [...(known?.notifications ?? []), ...fresh].slice(-60), ts: Date.now() };
            await store.putReferral(entry);
            return { ok: true, value: { entry, fresh } } as const;
        });
    }

    /** Send a referral change to every other connected socket whose user may see it. */
    function forwardReferral(entry: CachedReferral, fresh: NotificationRecord[], exceptSocketId?: string): number {
        if (!io) return 0;
        let sent = 0;
        for (const peer of io.sockets.sockets.values()) {
            if (peer.id === exceptSocketId) continue;
            const who = peer.data.identity as Identity | null | undefined;
            if (!who || !mayReceive(who, entry.referral)) continue;
            peer.emit('referral:update', { referral: entry.referral, notifications: notificationsFor(who, fresh) });
            sent += 1;
        }
        return sent;
    }

    /**
     * A directory entry as this user may see it. A device keeps PIN hashes so
     * its own staff can sign in offline — so it gets the hashes of the signed-in
     * user and of staff at the same facility, and no one else's. Anyone else's
     * hash on a phone is something to brute-force a short PIN from; a district
     * officer's or the Super Admin's never leaves the relay except to them.
     */
    function userFor(who: Identity, user: StaffUser): StaffUser {
        if (user.id === who.userId || (who.facilityId !== null && user.facilityId === who.facilityId)) return user;
        const { pinHash: _withheld, ...rest } = user;
        return { ...rest, pinHashWithheld: true };
    }

    /** Send a changed directory entry to each signed-in socket, as that user may see it. */
    function emitUser(user: StaffUser, except?: Socket) {
        if (!io) return;
        for (const peer of io.sockets.sockets.values()) {
            if (peer.id === except?.id) continue;
            const who = peer.data.identity as Identity | null | undefined;
            if (who) peer.emit('user:update', { user: userFor(who, user) });
        }
    }

    async function catchUpFor(who: Identity, since: number) {
        const [referrals, resources, tickets, users] = await Promise.all([store.listReferrals(), store.listResources(), store.listTickets(), store.listUsers()]);
        return {
            referrals: referrals
                .filter(e => e.ts > since && mayReceive(who, e.referral))
                .map(e => ({ referral: e.referral, notifications: notificationsFor(who, e.notifications) })),
            // Capacity is shared on purpose: the referral form shows every
            // facility's live availability so nobody refers into a full hospital.
            resources,
            tickets,
            // With PIN hashes only for staff who could sign in on this device (userFor).
            users: users.map(u => userFor(who, u)),
            serverTime: Date.now(),
        };
    }

    // ── capacity, maintenance, directory ─────────────────────────────────────

    /** Facility resources change beds: only their managers may publish them. */
    function mayPublishResources(who: Identity | null, facilityId: string, reason: unknown): boolean {
        if (!who) return false;
        const own = isDistrictWide(who.role) || who.facilityId === facilityId;
        if (can(who.role, 'capacity:manage') && own) return true;
        // Admission and discharge move occupancy as a consequence of a referral
        // action the workflow already authorised at that facility.
        return reason === 'OCCUPANCY' && who.facilityId === facilityId && (can(who.role, 'referral:arrival') || can(who.role, 'referral:discharge'));
    }

    const refuse = (who: Identity | null, message: string): Result<never> => ({ ok: false, status: who ? 403 : 401, reason: message });

    async function publishResources(body: unknown, who: Identity | null): Promise<Result<FacilityResources>> {
        const b = body as { resources?: FacilityResources; reason?: string } | undefined;
        if (!b?.resources?.facilityId) return { ok: false, status: 400, reason: 'resources missing' };
        if (!mayPublishResources(who, b.resources.facilityId, b.reason)) return refuse(who, 'Only that facility\'s bed manager may change its resources');
        await store.putResources(b.resources);
        return { ok: true, value: b.resources };
    }

    async function publishTicket(body: unknown, who: Identity | null): Promise<Result<MaintenanceTicket>> {
        const ticket = (body as { ticket?: MaintenanceTicket } | undefined)?.ticket;
        if (!ticket?.facilityId) return { ok: false, status: 400, reason: 'ticket missing' };
        if (!who || !can(who.role, 'maintenance:manage') || !(isDistrictWide(who.role) || who.facilityId === ticket.facilityId)) {
            return refuse(who, 'Only that facility\'s bed manager may log maintenance');
        }
        await store.putTicket(ticket);
        return { ok: true, value: ticket };
    }

    async function publishUser(body: unknown, who: Identity | null): Promise<Result<StaffUser>> {
        const user = (body as { user?: StaffUser } | undefined)?.user;
        if (!user?.id) return { ok: false, status: 400, reason: 'user missing' };
        if (!who || !can(who.role, 'admin:users')) return refuse(who, 'Only the Super Admin may change users');
        const existing = await directoryUser(user.id);
        // An edit that does not set a new PIN keeps the old one.
        const stored = { ...user, pinHash: user.pinHash ?? existing?.pinHash };
        await store.putUser(stored);
        return { ok: true, value: stored };
    }

    async function publishPatient(patient: unknown, who: Identity | null): Promise<Result<{ id: string }>> {
        const p = patient as { id?: unknown; timestamp?: string } | undefined;
        if (!who) return refuse(who, 'Sign in to share patient records');
        if (!can(who.role, 'patient:register')) return refuse(who, `${who.role} may not register patients`);
        if (typeof p?.id !== 'string') return { ok: false, status: 400, reason: 'body must be a patient record with an id' };
        await store.putPatient({ patient: p as { id: string }, ts: Date.parse(p.timestamp ?? '') || Date.now() });
        return { ok: true, value: { id: p.id } };
    }

    async function patientsSince(since: number) {
        return (await store.listPatients()).filter(e => e.ts > since).sort((a, b) => a.ts - b.ts).map(e => e.patient);
    }

    /** Send to identified sockets that hold `permission` (never to a signed-out socket). */
    function emitTo(permission: Parameters<typeof can>[1], event: string, data: unknown, except?: Socket) {
        if (!io) return;
        for (const peer of io.sockets.sockets.values()) {
            if (peer.id === except?.id) continue;
            const who = peer.data.identity as Identity | null | undefined;
            if (who && can(who.role, permission)) peer.emit(event, data);
        }
    }

    // ── HTTP ─────────────────────────────────────────────────────────────────

    const app = express();
    app.use((req, res, next) => {
        // The app is served from another origin (Vercel, another port, the APK).
        // No cookies are used — identity is a bearer token — so any origin may call.
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        // Responses carry session tokens and patient records: no cache on the
        // way may keep them, and none is to be read as anything but JSON.
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    });
    // 3 MB: a 20-second voice note for Bhashini, as base64 WAV, is about 1 MB.
    app.use(express.json({ limit: '3mb' }));

    /**
     * Express 4 does not catch a rejected async handler: without this, a store
     * that cannot be reached would crash the relay instead of answering. 503 is
     * what the app reads as "not sent yet" — it keeps the change and retries.
     */
    const route = (handler: (req: express.Request, res: express.Response) => Promise<unknown>) =>
        (req: express.Request, res: express.Response) => {
            handler(req, res).catch((error: unknown) => {
                log('Relay request failed', { path: req.path, error: error instanceof Error ? error.message : String(error) });
                if (!res.headersSent) res.status(503).json({ error: 'The relay could not reach its store — try again shortly' });
            });
        };

    const send = <T,>(res: express.Response, result: Result<T>, ok: (value: T) => object, status = 202) =>
        result.ok ? res.status(status).json(ok(result.value)) : res.status(result.status).json({ error: result.reason, ...(result.retry ? { retry: true } : {}) });

    app.post('/api/auth/login', route(async (req, res) => {
        const result = await signIn(req.body);
        send(res, result, v => v, 200);
    }));

    app.get('/api/auth/me', route(async (req, res) => {
        const who = await fromRequest(req);
        if (!who) return res.status(401).json({ error: 'Not signed in, or the session has expired' });
        res.json(who);
    }));

    app.get('/api/referrals/since/:timestamp', route(async (req, res) => {
        const who = await fromRequest(req);
        if (!who) return res.status(401).json({ error: 'Sign in to read referrals' });
        if (!can(who.role, 'referral:view')) return res.status(403).json({ error: `${who.role} may not read referrals` });
        const since = Number(req.params.timestamp);
        if (!Number.isFinite(since) || since < 0) return res.status(400).json({ error: 'timestamp must be Unix ms' });
        res.json(await catchUpFor(who, since));
    }));

    app.post('/api/referrals/publish', route(async (req, res) => {
        const result = await acceptReferral(req.body, await fromRequest(req));
        if (result.ok) forwardReferral(result.value.entry, result.value.fresh);
        send(res, result, v => ({ ok: true, id: v.entry.referral.id }));
    }));

    app.post('/api/resources/publish', route(async (req, res) => {
        const result = await publishResources(req.body, await fromRequest(req));
        if (result.ok) io?.emit('resources:update', { resources: result.value });
        send(res, result, () => ({ ok: true }));
    }));

    app.post('/api/tickets/publish', route(async (req, res) => {
        const result = await publishTicket(req.body, await fromRequest(req));
        if (result.ok) io?.emit('ticket:update', { ticket: result.value });
        send(res, result, () => ({ ok: true }));
    }));

    app.post('/api/users/publish', route(async (req, res) => {
        const result = await publishUser(req.body, await fromRequest(req));
        if (result.ok) emitUser(result.value);
        send(res, result, () => ({ ok: true }));
    }));

    app.get('/api/sync/since/:timestamp', route(async (req, res) => {
        const who = await fromRequest(req);
        if (!who) return res.status(401).json({ error: 'Sign in to read patient records' });
        if (!can(who.role, 'patient:view')) return res.status(403).json({ error: `${who.role} may not read patient records` });
        const since = Number(req.params.timestamp);
        if (!Number.isFinite(since) || since < 0) return res.status(400).json({ error: 'timestamp must be a Unix epoch value in milliseconds' });
        const records = await patientsSince(since);
        res.json({ since, serverTime: Date.now(), count: records.length, records });
    }));

    app.post('/api/sync/patient', route(async (req, res) => {
        const result = await publishPatient(req.body, await fromRequest(req));
        if (result.ok) emitTo('patient:view', 'patient:sync', req.body);
        send(res, result, v => ({ accepted: true, id: v.id }));
    }));

    // ── ABHA (citizen) verification — public: a citizen has no staff token ──
    const abhaFailure = (res: express.Response, error: unknown) => {
        if (error instanceof AbdmError) return res.status(error.status).json({ error: error.message });
        throw error;
    };

    app.post('/api/abha/otp', route(async (req, res) => {
        if (!abdm) return res.status(503).json({ error: 'ABHA verification is not configured on this server (ABDM sandbox credentials are not set)' });
        const abhaNumber = normaliseAbhaNumber(String((req.body as { abhaNumber?: unknown })?.abhaNumber ?? ''));
        if (!abhaNumber) return res.status(400).json({ error: 'An ABHA number is 14 digits, e.g. 91-1234-5678-9012' });
        // Each request texts the citizen: cap them per number so nobody can flood a phone.
        if ((await store.recordPinFailure(`abha-otp:${abhaNumber}`, ABHA_OTP_WINDOW_SECONDS)) > ABHA_OTP_REQUESTS) {
            return res.status(429).json({ error: 'Too many OTP requests for this ABHA number — try again in 15 minutes' });
        }
        try {
            res.json(await abdm.requestOtp(abhaNumber));
        } catch (error) {
            abhaFailure(res, error);
        }
    }));

    app.post('/api/abha/verify', route(async (req, res) => {
        if (!abdm) return res.status(503).json({ error: 'ABHA verification is not configured on this server (ABDM sandbox credentials are not set)' });
        const { txnId, otp } = (req.body ?? {}) as { txnId?: unknown; otp?: unknown };
        if (typeof txnId !== 'string' || !txnId || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
            return res.status(400).json({ error: 'Send the transaction id and the 6-digit OTP' });
        }
        if ((await store.recordPinFailure(`abha-verify:${txnId}`, ABHA_OTP_WINDOW_SECONDS)) > ABHA_VERIFY_ATTEMPTS) {
            return res.status(429).json({ error: 'Too many attempts — request a new OTP' });
        }
        try {
            const account = await abdm.verifyOtp(txnId, otp);
            log('ABHA verified', { status: account.status });
            res.json({ verified: true, account });
        } catch (error) {
            abhaFailure(res, error);
        }
    }));

    // ── Bhashini (staff) — speech recognition and translation ─────────────────
    const bhashiniFailure = (res: express.Response, error: unknown) => {
        if (error instanceof BhashiniError) return res.status(error.status).json({ error: error.message });
        throw error;
    };
    const notConfigured = { error: 'Bhashini is not configured on this server (BHASHINI_USER_ID, BHASHINI_ULCA_API_KEY and BHASHINI_PIPELINE_ID are not set)' };

    app.post('/api/bhashini/asr', route(async (req, res) => {
        const who = await fromRequest(req);
        if (!who) return res.status(401).json({ error: 'Sign in to use voice input' });
        if (!bhashini) return res.status(503).json(notConfigured);
        const { audio, language, samplingRate } = (req.body ?? {}) as { audio?: unknown; language?: unknown; samplingRate?: unknown };
        if (typeof audio !== 'string' || audio.length < 100) return res.status(400).json({ error: 'Send the recording as base64 WAV in "audio"' });
        if (!isBhashiniLanguage(language)) return res.status(400).json({ error: 'language must be en, hi or mr' });
        const rate = Number(samplingRate);
        if (!Number.isInteger(rate) || rate < 8000 || rate > 48000) return res.status(400).json({ error: 'samplingRate must be 8000–48000' });
        try {
            res.json({ text: await bhashini.transcribe(audio, language, rate) });
        } catch (error) {
            bhashiniFailure(res, error);
        }
    }));

    app.post('/api/bhashini/translate', route(async (req, res) => {
        const who = await fromRequest(req);
        if (!who) return res.status(401).json({ error: 'Sign in to translate' });
        if (!bhashini) return res.status(503).json(notConfigured);
        const { text, source, target } = (req.body ?? {}) as { text?: unknown; source?: unknown; target?: unknown };
        if (typeof text !== 'string' || !text.trim() || text.length > 2000) return res.status(400).json({ error: 'text must be 1–2000 characters' });
        if (!isBhashiniLanguage(source) || !isBhashiniLanguage(target)) return res.status(400).json({ error: 'source and target must be en, hi or mr' });
        try {
            res.json({ text: await bhashini.translate(text, source, target) });
        } catch (error) {
            bhashiniFailure(res, error);
        }
    }));

    app.get('/health', (_req, res) => {
        res.json({ status: 'healthy', store: store.kind, signIn: secret ? 'enabled' : 'not configured', abha: abdm ? 'configured' : 'not configured', bhashini: bhashini ? 'configured' : 'not configured', sockets: io ? io.sockets.sockets.size : null, uptime: process.uptime() });
    });

    app.get('/api', (_req, res) => {
        res.json({
            service: 'NalamMesh mesh relay',
            role: 'Courier between facilities. Every device\'s IndexedDB is the record; this holds a bounded, expiring copy for catch-up.',
            store: store.kind,
            auth: {
                signIn: 'POST /api/auth/login { userId, pin } → { token, expiresAt, user }. 401 wrong PIN, 423 locked, 403 no PIN set.',
                http: 'Authorization: Bearer <token> on every other route',
                websocket: 'Connect with auth { token }, or emit session:identify { token }',
                rule: 'Referral events must be authored by the signed-in user (409 { retry: true } while another user\'s change is still on its way)',
            },
            http: {
                'GET  /health': 'Liveness, store kind, whether sign-in is configured',
                'GET  /api/auth/me': 'Who the token belongs to',
                'GET  /api/referrals/since/:ms': 'Referrals, notifications, capacity, tickets and directory this user may see — referral:view',
                'POST /api/referrals/publish': 'A referral change — role rules and authorship checked',
                'POST /api/resources/publish': 'Beds and staff on duty — the facility\'s bed manager (or occupancy from an admission)',
                'POST /api/tickets/publish': 'Maintenance log entries — the facility\'s bed manager',
                'POST /api/users/publish': 'Staff directory changes — Super Admin',
                'GET  /api/sync/since/:ms': 'Patient records newer than a time — patient:view',
                'POST /api/sync/patient': 'Share one patient record — patient:register',
                'POST /api/abha/otp': 'Citizen: { abhaNumber } → { txnId } — ABDM sandbox texts an OTP (public, throttled)',
                'POST /api/abha/verify': 'Citizen: { txnId, otp } → { verified, account } (public, throttled)',
                'POST /api/bhashini/asr': 'Staff: { audio: base64 WAV, language: en|hi|mr, samplingRate } → { text }',
                'POST /api/bhashini/translate': 'Staff: { text, source, target } → { text }',
            },
            websocket: io ? 'Socket.IO on this port: referral:publish / referral:catchup / resources|ticket|user:publish, pushes referral:update and friends' : 'Not on this deployment — clients poll /api/referrals/since every 10 s',
        });
    });

    // ── websockets (local relay only) ────────────────────────────────────────

    function attachSockets(server: SocketIO): void {
        server.on('connection', socket => {
            // A failed store call inside a handler must not become an unhandled rejection.
            const safely = <A extends unknown[]>(fn: (...args: A) => Promise<unknown>) => (...args: A) => {
                fn(...args).catch((error: unknown) => {
                    log('Socket handler failed', { error: error instanceof Error ? error.message : String(error) });
                    const ack = args[args.length - 1];
                    if (typeof ack === 'function') (ack as (r: unknown) => void)({ ok: false, retry: true, reason: 'The relay could not reach its store' });
                });
            };
            const authenticate = async (token: unknown) => {
                socket.data.identity = await identify(typeof token === 'string' ? token : null);
                log('Socket identified', { socketId: socket.id, role: (socket.data.identity as Identity | null)?.role ?? 'signed out' });
            };
            const ready = authenticate((socket.handshake.auth as { token?: unknown } | undefined)?.token);
            const who = async () => { await ready; return (socket.data.identity as Identity | null | undefined) ?? null; };

            socket.on('session:identify', (raw: { token?: unknown } | null) => { void authenticate(raw?.token); });

            socket.on('referral:publish', safely(async (payload: unknown, ack?: (reply: { ok: boolean; reason?: string; retry?: boolean }) => void) => {
                const result = await acceptReferral(payload, await who());
                if (!result.ok) {
                    log('Referral refused', { reason: result.reason, status: result.status });
                    ack?.({ ok: false, reason: result.reason, retry: result.retry || result.status === 401 });
                    return;
                }
                const forwarded = forwardReferral(result.value.entry, result.value.fresh, socket.id);
                log('Referral relayed', { id: result.value.entry.referral.id, status: result.value.entry.referral.status, forwarded });
                ack?.({ ok: true });
            }));

            socket.on('referral:catchup', safely(async (data: { since?: number } | null, ack?: (batch: unknown) => void) => {
                const me = await who();
                if (!me) return ack?.({ referrals: [], resources: [], tickets: [], users: [], serverTime: Date.now() });
                ack?.(await catchUpFor(me, Number(data?.since) || 0));
            }));

            const guarded = <T,>(event: string, run: (body: unknown, me: Identity | null) => Promise<Result<T>>, broadcast: string, shape: (v: T) => object) => {
                socket.on(event, async (body: unknown, ack?: (reply: { ok: boolean; reason?: string }) => void) => {
                    const result = await run(body, await who());
                    if (!result.ok) {
                        log(`${event} refused`, { reason: result.reason });
                        return ack?.({ ok: false, reason: result.reason });
                    }
                    socket.broadcast.emit(broadcast, shape(result.value));
                    ack?.({ ok: true });
                });
            };
            guarded('resources:publish', publishResources, 'resources:update', resources => ({ resources }));
            guarded('ticket:publish', publishTicket, 'ticket:update', ticket => ({ ticket }));
            socket.on('user:publish', async (body: unknown, ack?: (reply: { ok: boolean; reason?: string }) => void) => {
                const result = await publishUser(body, await who());
                if (!result.ok) {
                    log('user:publish refused', { reason: result.reason });
                    return ack?.({ ok: false, reason: result.reason });
                }
                emitUser(result.value, socket);
                ack?.({ ok: true });
            });

            socket.on('patient:sync', safely(async (patient: unknown) => {
                const result = await publishPatient(patient, await who());
                if (!result.ok) return log('patient:sync refused', { reason: result.reason });
                emitTo('patient:view', 'patient:sync', patient, socket);
            }));

            socket.on('sync:request', safely(async (data: { since?: number } | null) => {
                const me = await who();
                if (!me || !can(me.role, 'patient:view')) return socket.emit('sync:batch', { patients: [], serverTime: Date.now() });
                socket.emit('sync:batch', { patients: await patientsSince(Number(data?.since) || 0), serverTime: Date.now() });
            }));

            // Clears every device's demo data: the Super Admin's call, nobody else's.
            socket.on('data:reset', safely(async () => {
                const me = await who();
                if (!me || !can(me.role, 'admin:users')) return log('data:reset refused', { role: me?.role ?? 'signed out' });
                await store.reset();
                socket.broadcast.emit('data:reset');
                log('Global reset broadcast', { by: me.userId });
            }));
        });
    }

    return { app, attachSockets, identify, signIn };
}
