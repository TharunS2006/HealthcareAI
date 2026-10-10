/**
 * Where the mesh relay keeps its courier's copy.
 *
 * On a laptop the relay is one long-lived process and memory is enough. On a
 * facility or State Data Centre server it is the same process, but a restart
 * must not lose the staff directory or a referral still waiting for an offline
 * facility, so its state is written through to a file (FileStore). Hosted on
 * Vercel it runs as short-lived functions — several at once, none guaranteed
 * to live — so its state goes to Upstash Redis instead, or a referral sent
 * through one instance would never reach a device polling another.
 *
 * Either way the relay is a courier, not a database: every device keeps its own
 * IndexedDB, entries are bounded, and hosted keys expire after RETENTION_SECONDS.
 *
 * @module server/relay/store
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { open, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Redis } from '@upstash/redis';
import type { ReferralRecord } from '../../types/patient';
import type { NotificationRecord } from '../../types/referral';
import type { FacilityResources, MaintenanceTicket } from '../../types/resources';
import type { StaffUser } from '../../lib/auth/users';

export interface CachedReferral {
    referral: ReferralRecord;
    notifications: NotificationRecord[];
    ts: number;
}

export interface CachedPatient {
    patient: { id: string; [key: string]: unknown };
    ts: number;
}

export interface RelayStore {
    readonly kind: 'memory' | 'file' | 'upstash';
    getReferral(id: string): Promise<CachedReferral | undefined>;
    putReferral(entry: CachedReferral): Promise<void>;
    listReferrals(): Promise<CachedReferral[]>;
    putPatient(entry: CachedPatient): Promise<void>;
    listPatients(): Promise<CachedPatient[]>;
    putResources(resources: FacilityResources): Promise<void>;
    listResources(): Promise<FacilityResources[]>;
    putTicket(ticket: MaintenanceTicket): Promise<void>;
    listTickets(): Promise<MaintenanceTicket[]>;
    putUser(user: StaffUser): Promise<void>;
    getUser(id: string): Promise<StaffUser | undefined>;
    listUsers(): Promise<StaffUser[]>;
    /** Count one failed PIN; returns failures in the current window. */
    recordPinFailure(userId: string, windowSeconds: number): Promise<number>;
    pinFailures(userId: string): Promise<number>;
    clearPinFailures(userId: string): Promise<void>;
    /** Run `fn` while no other instance works on the same key. */
    withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
    reset(): Promise<void>;
}

export const REFERRAL_LIMIT = 500;
export const PATIENT_LIMIT = 500;
export const RETENTION_SECONDS = 7 * 24 * 60 * 60;

/** Drop the oldest entries beyond `limit`. */
function trim<T extends { ts: number }>(map: Map<string, T>, limit: number): void {
    if (map.size <= limit) return;
    const oldest = [...map.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, map.size - limit);
    for (const [key] of oldest) map.delete(key);
}

export class MemoryStore implements RelayStore {
    readonly kind: 'memory' | 'file' = 'memory';
    protected referrals = new Map<string, CachedReferral>();
    protected patients = new Map<string, CachedPatient>();
    protected resources = new Map<string, FacilityResources>();
    protected tickets = new Map<string, MaintenanceTicket>();
    protected users = new Map<string, StaffUser>();
    private failures = new Map<string, { count: number; until: number }>();
    private locks = new Map<string, Promise<unknown>>();

    async getReferral(id: string) { return this.referrals.get(id); }
    async putReferral(entry: CachedReferral) { this.referrals.set(entry.referral.id, entry); trim(this.referrals, REFERRAL_LIMIT); }
    async listReferrals() { return [...this.referrals.values()]; }
    async putPatient(entry: CachedPatient) { this.patients.set(entry.patient.id, entry); trim(this.patients, PATIENT_LIMIT); }
    async listPatients() { return [...this.patients.values()]; }
    async putResources(r: FacilityResources) { this.resources.set(r.facilityId, r); }
    async listResources() { return [...this.resources.values()]; }
    async putTicket(t: MaintenanceTicket) { this.tickets.set(t.id, t); }
    async listTickets() { return [...this.tickets.values()]; }
    async putUser(u: StaffUser) { this.users.set(u.id, u); }
    async getUser(id: string) { return this.users.get(id); }
    async listUsers() { return [...this.users.values()]; }

    async recordPinFailure(userId: string, windowSeconds: number) {
        const now = Date.now();
        const f = this.failures.get(userId);
        const next = f && f.until > now ? { count: f.count + 1, until: f.until } : { count: 1, until: now + windowSeconds * 1000 };
        this.failures.set(userId, next);
        return next.count;
    }
    async pinFailures(userId: string) {
        const f = this.failures.get(userId);
        return f && f.until > Date.now() ? f.count : 0;
    }
    async clearPinFailures(userId: string) { this.failures.delete(userId); }

    async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
        // One process: chain work on the same key so a read-merge-write cannot interleave.
        const previous = this.locks.get(key) ?? Promise.resolve();
        const run = previous.catch(() => undefined).then(fn);
        this.locks.set(key, run);
        try {
            return await run;
        } finally {
            if (this.locks.get(key) === run) this.locks.delete(key);
        }
    }

    async reset() {
        this.referrals.clear(); this.patients.clear(); this.resources.clear(); this.tickets.clear(); this.users.clear(); this.failures.clear();
    }
}

interface Snapshot {
    version: 1;
    savedAt: string;
    referrals: CachedReferral[];
    patients: CachedPatient[];
    resources: FacilityResources[];
    tickets: MaintenanceTicket[];
    users: StaffUser[];
}

/**
 * Memory, written through to one JSON file — the relay on a facility or State
 * Data Centre server, where a restart must lose neither the staff directory
 * nor a referral still waiting for an offline facility.
 *
 * A change is on disk before the call that made it returns. Each write goes to
 * a temporary file that is then renamed over the old one, so a crash mid-write
 * leaves the previous copy, never half a file; changes made while a write runs
 * share the next one. The file holds staff PIN hashes and courier copies of
 * patient records, so it is created readable by its owner only, and belongs on
 * an encrypted volume that is backed up. A file that cannot be read stops the
 * relay rather than letting it start empty, which would quietly drop every
 * account and re-create the bootstrap Super Admin.
 *
 * PIN-failure counts stay in memory, as in MemoryStore: a restart ends a
 * lockout early, nothing more.
 */
export class FileStore extends MemoryStore {
    override readonly kind = 'file' as const;
    private saving: Promise<void> = Promise.resolve();
    private queued: Promise<void> | null = null;

    constructor(readonly path: string) {
        super();
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        let text: string | null = null;
        try {
            text = readFileSync(path, 'utf8');
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
        }
        if (text === null) return;
        let saved: Snapshot;
        try {
            saved = JSON.parse(text) as Snapshot;
        } catch {
            throw new Error(`relay store ${path} is not valid JSON — restore it from a backup, or move it aside to start empty`);
        }
        if (saved?.version !== 1) throw new Error(`relay store ${path} is in an unknown format (version ${String(saved?.version)})`);
        for (const e of saved.referrals ?? []) this.referrals.set(e.referral.id, e);
        for (const e of saved.patients ?? []) this.patients.set(e.patient.id, e);
        for (const r of saved.resources ?? []) this.resources.set(r.facilityId, r);
        for (const t of saved.tickets ?? []) this.tickets.set(t.id, t);
        for (const u of saved.users ?? []) this.users.set(u.id, u);
    }

    override async putReferral(entry: CachedReferral) { await super.putReferral(entry); await this.save(); }
    override async putPatient(entry: CachedPatient) { await super.putPatient(entry); await this.save(); }
    override async putResources(r: FacilityResources) { await super.putResources(r); await this.save(); }
    override async putTicket(t: MaintenanceTicket) { await super.putTicket(t); await this.save(); }
    override async putUser(u: StaffUser) { await super.putUser(u); await this.save(); }
    override async reset() { await super.reset(); await this.save(); }

    /** Resolves once a write holding every change made so far is on disk. */
    private save(): Promise<void> {
        if (this.queued) return this.queued;
        const queued = this.saving.catch(() => undefined).then(async () => {
            // Changes from here on need the write after this one.
            this.queued = null;
            const snapshot: Snapshot = {
                version: 1,
                savedAt: new Date().toISOString(),
                referrals: [...this.referrals.values()],
                patients: [...this.patients.values()],
                resources: [...this.resources.values()],
                tickets: [...this.tickets.values()],
                users: [...this.users.values()],
            };
            await this.write(JSON.stringify(snapshot));
        });
        this.queued = queued;
        this.saving = queued;
        return queued;
    }

    private async write(data: string): Promise<void> {
        const temporary = `${this.path}.tmp-${process.pid}`;
        const handle = await open(temporary, 'w', 0o600);
        try {
            await handle.chmod(0o600);
            await handle.writeFile(data, 'utf8');
            await handle.sync();
        } finally {
            await handle.close();
        }
        await rename(temporary, this.path);
    }
}

const K = {
    referrals: 'nm:referrals',
    patients: 'nm:patients',
    resources: 'nm:resources',
    tickets: 'nm:tickets',
    users: 'nm:users',
    failures: (userId: string) => `nm:pinfail:${userId}`,
    lock: (key: string) => `nm:lock:${key}`,
};

/** Upstash Redis over its REST API. Values are stored as JSON strings in hashes. */
export class UpstashStore implements RelayStore {
    readonly kind = 'upstash' as const;
    constructor(private redis: Redis) {}

    private async hput(key: string, field: string, value: unknown) {
        await this.redis.hset(key, { [field]: JSON.stringify(value) });
        await this.redis.expire(key, RETENTION_SECONDS);
    }
    private async hget<T>(key: string, field: string): Promise<T | undefined> {
        const raw = await this.redis.hget<string>(key, field);
        return typeof raw === 'string' ? (JSON.parse(raw) as T) : undefined;
    }
    private async hall<T>(key: string): Promise<T[]> {
        // With automatic deserialization off, HGETALL comes back as Redis sends
        // it — a flat [field, value, field, value, …] array — not an object.
        const all = (await this.redis.hgetall(key)) as unknown;
        if (!all) return [];
        const values = Array.isArray(all) ? all.filter((_, i) => i % 2 === 1) : Object.values(all as Record<string, unknown>);
        return values.map(v => JSON.parse(String(v)) as T);
    }
    private async bound<T extends { ts: number }>(key: string, limit: number, idOf: (v: T) => string) {
        const n = await this.redis.hlen(key);
        if (n <= limit) return;
        const oldest = (await this.hall<T>(key)).sort((a, b) => a.ts - b.ts).slice(0, n - limit).map(idOf);
        if (oldest.length) await this.redis.hdel(key, ...oldest);
    }

    getReferral(id: string) { return this.hget<CachedReferral>(K.referrals, id); }
    async putReferral(entry: CachedReferral) {
        await this.hput(K.referrals, entry.referral.id, entry);
        await this.bound<CachedReferral>(K.referrals, REFERRAL_LIMIT, e => e.referral.id);
    }
    listReferrals() { return this.hall<CachedReferral>(K.referrals); }
    async putPatient(entry: CachedPatient) {
        await this.hput(K.patients, entry.patient.id, entry);
        await this.bound<CachedPatient>(K.patients, PATIENT_LIMIT, e => e.patient.id);
    }
    listPatients() { return this.hall<CachedPatient>(K.patients); }
    putResources(r: FacilityResources) { return this.hput(K.resources, r.facilityId, r); }
    listResources() { return this.hall<FacilityResources>(K.resources); }
    putTicket(t: MaintenanceTicket) { return this.hput(K.tickets, t.id, t); }
    listTickets() { return this.hall<MaintenanceTicket>(K.tickets); }
    putUser(u: StaffUser) { return this.hput(K.users, u.id, u); }
    getUser(id: string) { return this.hget<StaffUser>(K.users, id); }
    listUsers() { return this.hall<StaffUser>(K.users); }

    async recordPinFailure(userId: string, windowSeconds: number) {
        const key = K.failures(userId);
        const count = await this.redis.incr(key);
        if (count === 1) await this.redis.expire(key, windowSeconds);
        return count;
    }
    async pinFailures(userId: string) {
        const raw = await this.redis.get<string | number>(K.failures(userId));
        return Number(raw) || 0;
    }
    async clearPinFailures(userId: string) { await this.redis.del(K.failures(userId)); }

    async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const lockKey = K.lock(key);
        const owner = Math.random().toString(36).slice(2);
        const deadline = Date.now() + 3000;
        let held = false;
        while (!held) {
            held = (await this.redis.set(lockKey, owner, { nx: true, px: 5000 })) === 'OK';
            if (held) break;
            if (Date.now() > deadline) throw new Error(`Relay busy: could not lock ${key}`);
            await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
        }
        try {
            return await fn();
        } finally {
            if ((await this.redis.get<string>(lockKey)) === owner) await this.redis.del(lockKey);
        }
    }

    async reset() {
        await this.redis.del(K.referrals, K.patients, K.resources, K.tickets, K.users);
    }
}

/**
 * Upstash when its REST credentials are present (either naming the Marketplace
 * uses); a file when NALAMMESH_RELAY_STORE_FILE names one; memory otherwise —
 * which a production relay refuses (durabilityProblem in ./mode).
 */
export function storeFromEnv(env: NodeJS.ProcessEnv = process.env): RelayStore {
    const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
    const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
    if (url && token) return new UpstashStore(new Redis({ url, token, automaticDeserialization: false }));
    const file = env.NALAMMESH_RELAY_STORE_FILE?.trim();
    if (file) return new FileStore(file);
    return new MemoryStore();
}
