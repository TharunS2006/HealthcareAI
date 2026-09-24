/**
 * Mesh Network Server - WebSocket-based simulation
 * Handles node registration, discovery, and message routing
 * @module server/mesh-server
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import crypto from 'crypto';
// The same rules the app runs — the relay refuses what the app would refuse.
import {
    canViewReferral,
    mergeReferral,
    normalizeReferral,
    verifyPublishedReferral,
} from '../lib/referrals/workflow';
import { can, isDistrictWide, isStaffRole, type StaffRole } from '../lib/auth/permissions';
import type { ReferralRecord } from '../types/patient';
import type { NotificationRecord } from '../types/referral';
import type { FacilityResources, MaintenanceTicket } from '../types/resources';
import type { StaffUser } from '../lib/auth/users';

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
    cors: {
        origin: "*",
        methods: ['GET', 'POST'],
    },
    pingTimeout: 10000,
    pingInterval: 5000,
});

interface MeshNode {
    nodeId: string;
    socketId: string;
    name: string;
    gps: { lat: number; lng: number };
    connectedAt: Date;
    lastSeen: Date;
}

interface RelayMessage {
    id: string;
    from: string;
    to?: string; // undefined = broadcast
    payload: unknown;
    timestamp: Date;
    hops: number;
}

const nodes = new Map<string, MeshNode>();

/**
 * Transient record cache backing catch-up sync.
 *
 * `patient:sync` is a live broadcast: a facility that was offline when a record
 * was created never saw it. The relay therefore keeps recent records in memory so
 * a node can ask for everything it missed on reconnect.
 *
 * Deliberately in-memory and bounded — the relay is a courier, not a database.
 * Each device's own IndexedDB remains the durable store.
 */
const patientCache = new Map<string, { patient: unknown; ts: number }>();
const PATIENT_CACHE_MAX = 500;

/**
 * Record one patient in the catch-up cache, evicting the oldest when over the bound.
 *
 * This cache is the only state the relay holds, it is in-memory, and it exists solely
 * so a facility that was offline can ask for what it missed. It is not a database:
 * each device's own store remains the durable copy.
 */
function cachePatient(patient: { id?: string; timestamp?: string }): void {
    if (!patient?.id) return;
    patientCache.set(patient.id, { patient, ts: Date.parse(patient.timestamp ?? '') || Date.now() });
    // Evict oldest first when over the bound.
    if (patientCache.size > PATIENT_CACHE_MAX) {
        const oldest = [...patientCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) patientCache.delete(oldest[0]);
    }
}
const messageCache = new Map<string, RelayMessage>();

// ── referrals between facilities ─────────────────────────────────────────────
//
// The relay forwards referral changes between devices and refuses the ones that
// break the role rules (lib/auth/permissions.ts, lib/referrals/workflow.ts): a
// Sub Centre "accepting" its own referral, a PHC answering another PHC's. Like
// the patient cache above, what it keeps is a bounded, in-memory courier's copy
// for catch-up — each device's IndexedDB stays the record.
//
// Identity is claimed, not proven (mock auth): a websocket says who it is with
// `session:identify`, an HTTP request with x-nalammesh-user / -role / -facility
// headers. The relay checks that the claimed role may do the thing and only
// forwards a referral to sockets whose user may see it.

interface Identity {
    userId: string;
    role: StaffRole;
    facilityId: string | null;
}

interface CachedReferral {
    referral: ReferralRecord;
    notifications: NotificationRecord[];
    ts: number;
}

const referralCache = new Map<string, CachedReferral>();
const REFERRAL_CACHE_MAX = 500;
const resourceCache = new Map<string, FacilityResources>();
const ticketCache = new Map<string, MaintenanceTicket>();
const userCache = new Map<string, StaffUser>();

function asIdentity(raw: unknown): Identity | null {
    const r = raw as Partial<Identity> | null | undefined;
    if (!r || typeof r.userId !== 'string' || !isStaffRole(r.role)) return null;
    return { userId: r.userId, role: r.role, facilityId: typeof r.facilityId === 'string' ? r.facilityId : null };
}

function identityFromHeaders(req: express.Request): Identity | null {
    return asIdentity({
        userId: req.header('x-nalammesh-user'),
        role: req.header('x-nalammesh-role'),
        facilityId: req.header('x-nalammesh-facility') ?? null,
    });
}

/** May this user be sent this referral? A receiver also gets it while CREATED, to confirm delivery. */
function mayReceive(identity: Identity | null, referral: ReferralRecord): boolean {
    if (!identity) return false;
    if (canViewReferral(identity, referral)) return true;
    return referral.status === 'CREATED'
        && identity.facilityId === referral.toFacilityId
        && can(identity.role, 'referral:receive');
}

function notificationsFor(identity: Identity, rows: NotificationRecord[]): NotificationRecord[] {
    return rows.filter(n => n.recipient_user_id === identity.userId || (identity.facilityId !== null && n.facility_id === identity.facilityId));
}

function acceptReferral(payload: unknown): { ok: true; entry: CachedReferral; fresh: NotificationRecord[] } | { ok: false; reason: string } {
    const body = payload as { referral?: ReferralRecord; notifications?: NotificationRecord[] } | undefined;
    const incoming = body?.referral;
    if (!incoming || typeof incoming.id !== 'string' || !Array.isArray(incoming.timeline)) {
        return { ok: false, reason: 'Body must carry a referral with an id and a timeline' };
    }
    const known = referralCache.get(incoming.id);
    const verdict = verifyPublishedReferral(known?.referral, incoming);
    if (!verdict.ok) return { ok: false, reason: verdict.message };

    const merged = mergeReferral(known?.referral, normalizeReferral(incoming));
    const seen = new Set((known?.notifications ?? []).map(n => n.id));
    const fresh = (Array.isArray(body?.notifications) ? body!.notifications : []).filter(n => n && typeof n.id === 'string' && !seen.has(n.id));
    const entry: CachedReferral = {
        referral: merged,
        notifications: [...(known?.notifications ?? []), ...fresh].slice(-60),
        ts: Date.now(),
    };
    referralCache.set(merged.id, entry);
    if (referralCache.size > REFERRAL_CACHE_MAX) {
        const oldest = [...referralCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
        if (oldest) referralCache.delete(oldest[0]);
    }
    return { ok: true, entry, fresh };
}

/** Send a referral change to every other socket whose user may see it. */
function forwardReferral(entry: CachedReferral, fresh: NotificationRecord[], exceptSocketId?: string): number {
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

/** Facility resources and tickets change beds: only their managers may publish them. */
function mayPublishResources(who: Identity | null, facilityId: string, reason: unknown): boolean {
    if (!who) return false;
    const own = isDistrictWide(who.role) || who.facilityId === facilityId;
    if (can(who.role, 'capacity:manage') && own) return true;
    // Admission and discharge move occupancy as a consequence of a referral
    // action the workflow already authorised at that facility.
    return reason === 'OCCUPANCY' && who.facilityId === facilityId
        && (can(who.role, 'referral:arrival') || can(who.role, 'referral:discharge'));
}

function catchUpFor(who: Identity, since: number) {
    return {
        referrals: [...referralCache.values()]
            .filter(e => e.ts > since && mayReceive(who, e.referral))
            .map(e => ({ referral: e.referral, notifications: notificationsFor(who, e.notifications) })),
        // Capacity is shared on purpose: the referral form shows every
        // facility's live availability so nobody refers into a full hospital.
        resources: [...resourceCache.values()],
        tickets: [...ticketCache.values()],
        users: [...userCache.values()],
        serverTime: Date.now(),
    };
}
const MAX_HOPS = 5;
const MESSAGE_TTL_MS = 60000; // 1minute

/**
 * Log with timestamp
 */
function log(message: string, data?: object): void {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        message,
        ...data,
    }));
}

/**
 * Clean expired messages from cache
 */
function cleanMessageCache(): void {
    const now = Date.now();
    messageCache.forEach((msg, id) => {
        if (now - msg.timestamp.getTime() > MESSAGE_TTL_MS) {
            messageCache.delete(id);
        }
    });
}

// Clean cache every minute
setInterval(cleanMessageCache, 60000);

io.on('connection', (socket) => {
    log('New connection', { socketId: socket.id });

    /**
     * Node registration
     */
    socket.on('mesh:register', (data: {
        nodeId: string;
        name: string;
        gps: { lat: number; lng: number };
    }) => {
        const node: MeshNode = {
            nodeId: data.nodeId,
            socketId: socket.id,
            name: data.name,
            gps: data.gps,
            connectedAt: new Date(),
            lastSeen: new Date(),
        };

        nodes.set(data.nodeId, node);

        log('Node registered', {
            nodeId: data.nodeId,
            name: data.name,
            totalNodes: nodes.size,
        });

        // Broadcast updated node list to all clients
        io.emit('mesh:nodes:update', Array.from(nodes.values()));

        // Send confirmation
        socket.emit('mesh:registered', {
            nodeId: data.nodeId,
            peers: Array.from(nodes.values()).filter(n => n.nodeId !== data.nodeId),
        });
    });

    /**
     * Heartbeat to keep node alive
     */
    socket.on('mesh:heartbeat', (data: { nodeId: string }) => {
        const node = nodes.get(data.nodeId);
        if (node) {
            node.lastSeen = new Date();
        }
    });

    /**
     * Message relay
     */
    socket.on('mesh:relay', (data: RelayMessage) => {
        // Check if message already processed (prevent loops)
        if (messageCache.has(data.id)) {
            log('Duplicate message ignored', { messageId: data.id });
            return;
        }

        // Check hop limit
        if (data.hops >= MAX_HOPS) {
            log('Message exceeded max hops', {
                messageId: data.id,
                hops: data.hops,
            });
            return;
        }

        // Cache message
        messageCache.set(data.id, data);

        log('Message relayed', {
            messageId: data.id,
            from: data.from,
            to: data.to || 'broadcast',
            hops: data.hops,
        });

        // Increment hop count
        data.hops++;

        // Targeted delivery or broadcast
        if (data.to) {
            const targetNode = nodes.get(data.to);
            if (targetNode) {
                io.to(targetNode.socketId).emit('mesh:message', data);
            }
        } else {
            // Broadcast to all except sender
            const senderNode = nodes.get(data.from);
            if (senderNode) {
                socket.broadcast.emit('mesh:message', data);
            }
        }
    });

    /**
     * Patient Data Sync
     * Broadcasts new/updated patient records to all connected clients
     */
    socket.on('patient:sync', (patient: any) => {
        cachePatient(patient);
        // Broadcast to everyone else (excluding sender)
        socket.broadcast.emit('patient:sync', patient);
        log('Patient sync broadcasted', { patientId: patient.id });
    });

    /**
     * Catch-up sync.
     * A node that was offline asks for everything newer than it last saw, and the
     * relay replays from its cache. Without this, a facility that missed the live
     * broadcast never learns the record exists.
     */
    socket.on('sync:request', (data: { since?: number }) => {
        const since = Number(data?.since) || 0;
        const missed = [...patientCache.values()]
            .filter((e) => e.ts > since)
            .sort((a, b) => a.ts - b.ts)
            .map((e) => e.patient);

        socket.emit('sync:batch', { patients: missed, serverTime: Date.now() });
        log('Catch-up sync served', { since, records: missed.length });
    });

    /** Who is using this socket — decides which referral updates it is sent. */
    socket.on('session:identify', (raw: unknown) => {
        socket.data.identity = asIdentity(raw);
        log('Socket identified', { socketId: socket.id, role: (socket.data.identity as Identity | null)?.role ?? 'signed out' });
    });

    socket.on('referral:publish', (payload: unknown, ack?: (reply: { ok: boolean; reason?: string }) => void) => {
        const result = acceptReferral(payload);
        if (!result.ok) {
            log('Referral refused', { reason: result.reason });
            ack?.({ ok: false, reason: result.reason });
            return;
        }
        const forwarded = forwardReferral(result.entry, result.fresh, socket.id);
        log('Referral relayed', { id: result.entry.referral.id, status: result.entry.referral.status, forwarded });
        ack?.({ ok: true });
    });

    socket.on('referral:catchup', (data: { since?: number; actor?: unknown }, ack?: (batch: unknown) => void) => {
        const who = (socket.data.identity as Identity | null | undefined) ?? asIdentity(data?.actor);
        if (!who) {
            ack?.({ referrals: [], resources: [], tickets: [], users: [], serverTime: Date.now() });
            return;
        }
        ack?.(catchUpFor(who, Number(data?.since) || 0));
    });

    const guarded = <T,>(
        event: string,
        check: (who: Identity | null, body: T) => string | null,
        store: (body: T) => void,
        broadcast: string
    ) => {
        socket.on(event, (body: T & { actor?: unknown }, ack?: (reply: { ok: boolean; reason?: string }) => void) => {
            const who = asIdentity(body?.actor) ?? (socket.data.identity as Identity | null | undefined) ?? null;
            const refusal = check(who, body);
            if (refusal) {
                log(`${event} refused`, { reason: refusal });
                ack?.({ ok: false, reason: refusal });
                return;
            }
            store(body);
            const { actor: _actor, ...clean } = body as T & { actor?: unknown };
            socket.broadcast.emit(broadcast, clean);
            ack?.({ ok: true });
        });
    };

    guarded<{ resources: FacilityResources; reason?: string }>(
        'resources:publish',
        (who, b) => (!b?.resources?.facilityId ? 'resources missing' : mayPublishResources(who, b.resources.facilityId, b.reason) ? null : 'Only that facility\'s bed manager may change its resources'),
        b => resourceCache.set(b.resources.facilityId, b.resources),
        'resources:update'
    );
    guarded<{ ticket: MaintenanceTicket }>(
        'ticket:publish',
        (who, b) => (!b?.ticket?.facilityId ? 'ticket missing'
            : who && can(who.role, 'maintenance:manage') && (isDistrictWide(who.role) || who.facilityId === b.ticket.facilityId) ? null
            : 'Only that facility\'s bed manager may log maintenance'),
        b => ticketCache.set(b.ticket.id, b.ticket),
        'ticket:update'
    );
    guarded<{ user: StaffUser }>(
        'user:publish',
        (who, b) => (!b?.user?.id ? 'user missing' : who && can(who.role, 'admin:users') ? null : 'Only the Super Admin may change users'),
        b => userCache.set(b.user.id, b.user),
        'user:update'
    );

    /**
     * Global Data Reset Sync
     * Broadcasts a reset command to all connected clients
     */
    socket.on('data:reset', () => {
        patientCache.clear();
        referralCache.clear();
        resourceCache.clear();
        ticketCache.clear();
        userCache.clear();
        // Broadcast to everyone else (excluding sender)
        socket.broadcast.emit('data:reset');
        log('Global reset command broadcasted');
    });

    /**
     * Disconnect handling
     */
    socket.on('disconnect', () => {
        // Find and remove disconnected node
        let disconnectedNodeId: string | undefined;
        nodes.forEach((node, nodeId) => {
            if (node.socketId === socket.id) {
                disconnectedNodeId = nodeId;
                nodes.delete(nodeId);
            }
        });

        if (disconnectedNodeId) {
            log('Node disconnected', {
                nodeId: disconnectedNodeId,
                remainingNodes: nodes.size,
            });

            // Notify all clients
            io.emit('mesh:nodes:update', Array.from(nodes.values()));
        }
    });
});

// Health check endpoint
// Browsers call the HTTP fallback cross-origin (the app is served from another
// port or the APK), with identity headers — so answer CORS preflights. Same open
// origin policy as the websocket above.
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-nalammesh-user, x-nalammesh-role, x-nalammesh-facility');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});
app.use(express.json({ limit: '1mb' }));

/**
 * Self-documenting index. A websocket protocol is hard to inspect from outside,
 * so the relay publishes its own contract here.
 */
app.get('/api', (_req, res) => {
    res.json({
        service: 'NalamMesh mesh relay',
        role: 'Message courier between facilities. Holds no durable data — each device\'s IndexedDB is the source of truth.',
        http: {
            'GET  /api': 'This contract',
            'GET  /health': 'Liveness, connected node count, uptime',
            'GET  /metrics': 'Connected nodes with connect/last-seen timestamps',
            'GET  /api/nodes': 'Facilities currently on the mesh',
            'GET  /api/sync/status': 'Relay cache depth and oldest/newest record',
            'GET  /api/sync/since/:timestamp': 'Records newer than a Unix ms timestamp (HTTP catch-up) — needs patient:view',
            'POST /api/sync/patient': 'Push one record into the mesh over HTTP — needs patient:register',
            'GET  /api/referrals/since/:timestamp': 'Referrals, notifications, resources and tickets this user may see — needs referral:view',
            'POST /api/referrals/publish': 'Publish a referral change; refused (403) when an event breaks the role rules',
            'POST /api/resources/publish': 'Beds and staff on duty — the facility\'s bed manager (or occupancy from an admission)',
            'POST /api/tickets/publish': 'Maintenance log entries — the facility\'s bed manager',
            'POST /api/users/publish': 'Staff directory changes — Super Admin',
        },
        auth: {
            note: 'Mock identity: claimed, not proven. The relay checks that the claimed role may do the thing (lib/auth/permissions.ts).',
            http: 'Headers x-nalammesh-user, x-nalammesh-role, x-nalammesh-facility',
            websocket: 'Emit session:identify { userId, role, facilityId } after connecting',
        },
        websocket: {
            note: 'Primary transport. Socket.io on the same port.',
            clientEmits: {
                'mesh:register': 'Join the mesh with nodeId, name, gps',
                'mesh:heartbeat': 'Liveness ping',
                'mesh:relay': 'Relay a message, targeted or broadcast',
                'patient:sync': 'Publish a patient record to peers',
                'sync:request': 'Ask for records newer than { since }',
                'data:reset': 'Clear the mesh and all peer databases',
                'session:identify': 'Say who is using this socket; scopes the referral updates it is sent',
                'referral:publish': 'Publish a referral change (ack: { ok, reason })',
                'referral:catchup': 'Ask for referral changes newer than { since } (ack: batch)',
                'resources:publish / ticket:publish / user:publish': 'Capacity, maintenance and directory changes (ack: { ok, reason })',
            },
            serverEmits: {
                'mesh:registered': 'Registration acknowledged, with current peers',
                'mesh:nodes:update': 'Node list changed',
                'mesh:message': 'A relayed message addressed to this node',
                'patient:sync': 'A peer published a record',
                'sync:batch': 'Catch-up payload answering sync:request',
                'referral:update': 'A referral this user may see changed, with the notifications addressed to them',
                'resources:update / ticket:update / user:update': 'Capacity, maintenance or directory changed on another device',
            },
        },
        guarantees: {
            loopPrevention: 'Message ids are cached and duplicates dropped',
            hopLimit: MAX_HOPS,
            messageTtlMs: MESSAGE_TTL_MS,
            recordCacheMax: PATIENT_CACHE_MAX,
            durability: 'None by design. The relay is a courier; devices own their data.',
        },
    });
});

/** Facilities currently on the mesh. */
app.get('/api/nodes', (_req, res) => {
    res.json({
        count: nodes.size,
        nodes: Array.from(nodes.values()).map((n) => ({
            nodeId: n.nodeId, name: n.name, gps: n.gps,
            connectedAt: n.connectedAt, lastSeen: n.lastSeen,
        })),
    });
});

/** Depth of the catch-up cache. */
app.get('/api/sync/status', (_req, res) => {
    const entries = [...patientCache.values()].map((e) => e.ts).sort((a, b) => a - b);
    res.json({
        cachedRecords: patientCache.size,
        capacity: PATIENT_CACHE_MAX,
        oldestRecordAt: entries[0] ? new Date(entries[0]).toISOString() : null,
        newestRecordAt: entries.length ? new Date(entries[entries.length - 1]).toISOString() : null,
        connectedNodes: nodes.size,
    });
});

/**
 * HTTP catch-up. Mirrors the sync:request socket event for clients that cannot
 * hold a websocket open — a real constraint on intermittent rural links.
 */
app.get('/api/sync/since/:timestamp', (req, res) => {
    const who = identityFromHeaders(req);
    if (!who) return res.status(401).json({ error: 'Send x-nalammesh-user and x-nalammesh-role headers' });
    if (!can(who.role, 'patient:view')) return res.status(403).json({ error: `${who.role} may not read patient records` });
    const since = Number(req.params.timestamp);
    if (!Number.isFinite(since) || since < 0) {
        return res.status(400).json({ error: 'timestamp must be a Unix epoch value in milliseconds' });
    }
    const records = [...patientCache.values()]
        .filter((e) => e.ts > since)
        .sort((a, b) => a.ts - b.ts)
        .map((e) => e.patient);
    res.json({ since, serverTime: Date.now(), count: records.length, records });
});

/** HTTP publish. Mirrors the patient:sync socket event. */
app.post('/api/sync/patient', (req, res) => {
    const who = identityFromHeaders(req);
    if (!who) return res.status(401).json({ error: 'Send x-nalammesh-user and x-nalammesh-role headers' });
    if (!can(who.role, 'patient:register')) return res.status(403).json({ error: `${who.role} may not register patients` });
    const patient = req.body;
    if (!patient?.id) {
        return res.status(400).json({ error: 'body must be a patient record with an id' });
    }
    cachePatient(patient);
    io.emit('patient:sync', patient);
    log('Patient published over HTTP', { patientId: patient.id });
    res.status(202).json({ accepted: true, id: patient.id, broadcastTo: nodes.size });
});

/** Referrals this user may see — the HTTP twin of referral:catchup, for the 10-second poll. */
app.get('/api/referrals/since/:timestamp', (req, res) => {
    const who = identityFromHeaders(req);
    if (!who) return res.status(401).json({ error: 'Send x-nalammesh-user and x-nalammesh-role headers' });
    if (!can(who.role, 'referral:view')) return res.status(403).json({ error: `${who.role} may not read referrals` });
    const since = Number(req.params.timestamp);
    if (!Number.isFinite(since) || since < 0) return res.status(400).json({ error: 'timestamp must be Unix ms' });
    res.json(catchUpFor(who, since));
});

/** Publish a referral change over HTTP — checked against the same rules as the websocket. */
app.post('/api/referrals/publish', (req, res) => {
    const result = acceptReferral(req.body);
    if (!result.ok) return res.status(403).json({ error: result.reason });
    const forwarded = forwardReferral(result.entry, result.fresh);
    res.status(202).json({ ok: true, id: result.entry.referral.id, forwarded });
});

app.post('/api/resources/publish', (req, res) => {
    const who = identityFromHeaders(req);
    const body = req.body as { resources?: FacilityResources; reason?: string };
    if (!body?.resources?.facilityId) return res.status(400).json({ error: 'resources missing' });
    if (!mayPublishResources(who, body.resources.facilityId, body.reason)) {
        return res.status(who ? 403 : 401).json({ error: 'Only that facility\'s bed manager may change its resources' });
    }
    resourceCache.set(body.resources.facilityId, body.resources);
    io.emit('resources:update', { resources: body.resources });
    res.status(202).json({ ok: true });
});

app.post('/api/tickets/publish', (req, res) => {
    const who = identityFromHeaders(req);
    const ticket = (req.body as { ticket?: MaintenanceTicket })?.ticket;
    if (!ticket?.facilityId) return res.status(400).json({ error: 'ticket missing' });
    if (!who || !can(who.role, 'maintenance:manage') || !(isDistrictWide(who.role) || who.facilityId === ticket.facilityId)) {
        return res.status(who ? 403 : 401).json({ error: 'Only that facility\'s bed manager may log maintenance' });
    }
    ticketCache.set(ticket.id, ticket);
    io.emit('ticket:update', { ticket });
    res.status(202).json({ ok: true });
});

app.post('/api/users/publish', (req, res) => {
    const who = identityFromHeaders(req);
    const user = (req.body as { user?: StaffUser })?.user;
    if (!user?.id) return res.status(400).json({ error: 'user missing' });
    if (!who || !can(who.role, 'admin:users')) return res.status(who ? 403 : 401).json({ error: 'Only the Super Admin may change users' });
    userCache.set(user.id, user);
    io.emit('user:update', { user });
    res.status(202).json({ ok: true });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        nodes: nodes.size,
        cachedMessages: messageCache.size,
        uptime: process.uptime(),
    });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    res.json({
        nodes: Array.from(nodes.values()).map(n => ({
            nodeId: n.nodeId,
            name: n.name,
            connectedAt: n.connectedAt,
            lastSeen: n.lastSeen,
        })),
        messageCache: messageCache.size,
    });
});

const PORT = process.env.PORT || 3001;

/**
 * A relay left running from an earlier session is the usual reason this port is
 * taken. Node's default here is an unhandled 'error' event and a stack trace,
 * which is alarming and says nothing useful — print the fix instead.
 */
httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
        console.error(
            `\nMesh relay: port ${PORT} is already in use.\n\n` +
            `Another relay is probably still running. Either use it as-is, or stop it:\n` +
            `    lsof -ti :${PORT} | xargs kill\n\n` +
            `To run on a different port instead:\n` +
            `    PORT=3002 npm run server\n`
        );
        process.exit(1);
    }
    throw err;
});

httpServer.listen(PORT, () => {
    log(`Mesh network server running on port ${PORT}`);
});
