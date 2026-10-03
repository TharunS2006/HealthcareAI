/**
 * Where the mesh relay keeps its courier's copy.
 *
 * On a laptop the relay is one long-lived process and memory is enough. Hosted
 * on Vercel it runs as short-lived functions — several at once, none guaranteed
 * to live — so its state goes to Upstash Redis instead, or a referral sent
 * through one instance would never reach a device polling another.
 *
 * Either way the relay is a courier, not a database: every device keeps its own
 * IndexedDB, entries are bounded, and hosted keys expire after RETENTION_SECONDS.
 *
 * @module server/relay/store
 */

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
    readonly kind: 'memory' | 'upstash';
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
    readonly kind = 'memory' as const;
    private referrals = new Map<string, CachedReferral>();
    private patients = new Map<string, CachedPatient>();
    private resources = new Map<string, FacilityResources>();
    private tickets = new Map<string, MaintenanceTicket>();
    private users = new Map<string, StaffUser>();
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

/** Upstash when its REST credentials are present (either naming the Marketplace uses), memory otherwise. */
export function storeFromEnv(env: NodeJS.ProcessEnv = process.env): RelayStore {
    const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
    const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
    if (url && token) return new UpstashStore(new Redis({ url, token, automaticDeserialization: false }));
    return new MemoryStore();
}
