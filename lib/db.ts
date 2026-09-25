/**
 * IndexedDB wrapper for offline rural public healthcare data storage
 * Version 6: longitudinal patients, the referral lifecycle with notifications, staff
 * directory, facility resources and maintenance log, queue, stock and diagnostics.
 * v6 adds no stores: it re-keys records that name a retired facility id, and
 * repairs databases an abandoned development build left at version 5.
 * @module lib/db */

import { openDB, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import toast from 'react-hot-toast';
import { Patient, SyncQueueItem, ReferralRecord, VisitRecord } from '@/types/patient';
import { QueueEntry, MedicineStockItem, DiagnosticOrder, Facility, AuditLogEntry } from '@/types/facility';
import { Appointment } from '@/types/appointment';
import type { NotificationRecord, ReferralEvent } from '@/types/referral';
import type { FacilityResources, MaintenanceTicket, WardType } from '@/types/resources';
import type { StaffUser } from '@/lib/auth/users';
import { SEED_USERS } from '@/lib/auth/users';
import { SEED_REFERRALS, SEED_NOTIFICATIONS } from '@/lib/data/referralSeed';
import { SEED_RESOURCES, SEED_MAINTENANCE } from '@/lib/data/resources';
import { RETIRED_FACILITY_IDS, remapRetiredFacilityIds } from '@/lib/data/facilityIds';
import { PLACE_NAME_STORES, restorePlaceNames } from '@/lib/data/placeNames';
import { normalizeReferral } from '@/lib/referrals/workflow';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { retry } from '@/lib/utils/retry';
import {
    SEED_PATIENTS,
    SEED_QUEUE,
    SEED_MEDICINES,
    SEED_DIAGNOSTICS,
    FACILITY_NETWORK
} from '@/lib/data/facilities';

type NalamMeshDB = {
    patients: {
        key: string;
        value: Patient;
        indexes: {
            'by-sync': boolean;
            'by-timestamp': string;
            'by-triage': string;
        };
    };
    referrals: {
        key: string;
        value: ReferralRecord;
        indexes: {
            'by-status': string;
            'by-priority': string;
            'by-from-facility': string;
            'by-to-facility': string;
        };
    };
    queue: {
        key: string;
        value: QueueEntry;
        indexes: {
            'by-facility': string;
            'by-status': string;
            'by-priority': string;
        };
    };
    facilities: {
        key: string;
        value: Facility;
        indexes: {
            'by-type': string;
            'by-district': string;
        };
    };
    medicineStock: {
        key: string;
        value: MedicineStockItem;
        indexes: {
            'by-facility': string;
            'by-status': string;
            'by-category': string;
        };
    };
    diagnostics: {
        key: string;
        value: DiagnosticOrder;
        indexes: {
            'by-facility': string;
            'by-patient': string;
            'by-status': string;
        };
    };
    syncQueue: {
        key: string;
        value: SyncQueueItem;
        indexes: { 'by-retry': number };
    };
    auditLog: {
        key: string;
        value: AuditLogEntry;
        indexes: {
            'by-entity': string;
            'by-timestamp': string;
            'by-actor': string;
        };
    };
    appointments: {
        key: string;
        value: Appointment;
        indexes: {
            'by-facility': string;
            'by-date': string;
            'by-patient': string;
            'by-status': string;
        };
    };
    notifications: {
        key: string;
        value: NotificationRecord;
        indexes: {
            'by-recipient': string;
            'by-referral': string;
            'by-created': string;
        };
    };
    users: {
        key: string;
        value: StaffUser;
        indexes: { 'by-role': string };
    };
    facilityResources: {
        key: string;
        value: FacilityResources;
    };
    maintenanceLog: {
        key: string;
        value: MaintenanceTicket;
        indexes: {
            'by-facility': string;
            'by-status': string;
        };
    };
};

/** Referral ids seeded before the lifecycle rework, replaced by the v5 seed. */
const LEGACY_SEED_REFERRAL_IDS = ['ref-2025-01', 'ref-2025-02', 'ref-2025-03', 'ref-2025-04'];

const DB_NAME = 'nalammesh-rural-db';
/**
 * 6, not 5: an abandoned development build (git stash "WIP on
 * rbac-referral-flow") also opened this database as version 5 — with none of
 * the v5 stores. A browser that ran it opened here with no upgrade and failed
 * on every read. So the upgrade decides what to migrate from the stores it
 * finds, not from the version number alone.
 */
const DB_VERSION = 6;

type UpgradeTransaction = IDBPTransaction<NalamMeshDB, StoreNames<NalamMeshDB>[], 'versionchange'>;

/** Stores whose records can name a facility. The audit log is left as it was written. */
const FACILITY_REFERENCING_STORES = [
    'referrals', 'patients', 'queue', 'medicineStock', 'diagnostics', 'appointments',
    'syncQueue', 'notifications', 'users', 'maintenanceLog',
] as const;

const SUPERSEDED_MESSAGE = 'NalamMesh was updated in another tab. Reload this page to keep working.';

/** This page's one connection, open or opening. */
let dbPromise: Promise<IDBPDatabase<NalamMeshDB>> | null = null;
/** Another tab upgraded the database past this page's code: only a reload helps. */
let superseded = false;

export class DatabaseError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'DatabaseError';
    }
}

/**
 * Open this device's database, upgrading and seeding it on first use.
 *
 * Every caller shares one open. A cold start used to open a connection for each
 * store that loaded first, each running its own seeding pass and all but one
 * left open — and a connection left open blocks the next upgrade.
 */
export async function getDB(): Promise<IDBPDatabase<NalamMeshDB>> {
    if (superseded) throw new DatabaseError(SUPERSEDED_MESSAGE);
    if (!dbPromise) {
        dbPromise = openDatabase().catch((error: unknown) => {
            dbPromise = null; // the next call tries again
            // name and message spelled out: the logger JSON-encodes its context,
            // and an Error or DOMException encodes as {}.
            logger.error('Failed to initialize IndexedDB', {
                error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
            });
            throw new DatabaseError('Failed to initialize database', error);
        });
    }
    return dbPromise;
}

/** Close this page's connection. The next getDB() opens (and if need be upgrades) afresh. */
export async function closeDB(): Promise<void> {
    const pending = dbPromise;
    dbPromise = null;
    superseded = false;
    const db = pending ? await pending.catch(() => null) : null;
    db?.close();
}

function openDatabase(): Promise<IDBPDatabase<NalamMeshDB>> {
    return retry(
        async () => {
            const db = await openDB<NalamMeshDB>(DB_NAME, DB_VERSION, {
                // All or nothing. idb does not abort when an async upgrade throws, so
                // without this a migration failing part-way would leave the device
                // on the new version with half its records moved, never to rerun.
                upgrade(database, oldVersion, newVersion, tx) {
                    // An abort also rejects tx.done; openDB reports it, so observe it here.
                    tx.done.catch(() => undefined);
                    upgradeDatabase(database, oldVersion, newVersion, tx).catch((error: unknown) => {
                        logger.error('IndexedDB upgrade failed and was rolled back', {
                            fromVersion: oldVersion,
                            error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
                        });
                        try {
                            tx.abort();
                        } catch {
                            // already aborting: a failed request aborts its transaction
                        }
                    });
                },
                // This page's upgrade is waiting for a tab still on the old version.
                // It carries on by itself once that tab closes or reloads.
                blocked() {
                    logger.warn('IndexedDB upgrade waiting for another NalamMesh tab');
                    toast.error('NalamMesh is open in another tab on an older version. Close or reload that tab to continue.', {
                        id: 'db-blocked',
                        duration: 15000,
                    });
                },
                // A newer version in another tab needs this connection closed.
                blocking(_currentVersion, _blockedVersion, event) {
                    (event.target as IDBDatabase).close();
                    superseded = true;
                    dbPromise = null;
                    toast.error(SUPERSEDED_MESSAGE, { id: 'db-superseded', duration: Infinity });
                },
                // Closed by the browser (site data cleared, storage failure): reopen on next use.
                terminated() {
                    dbPromise = null;
                    logger.error('IndexedDB connection closed by the browser');
                },
            });
            try {
                await seedDatabase(db);
            } catch (error) {
                db.close(); // a failed attempt must not leave a connection open
                throw error;
            }
            return db;
        },
        { maxRetries: 3, initialDelay: 500, maxDelay: 3000 }
    );
}

async function upgradeDatabase(
    db: IDBPDatabase<NalamMeshDB>,
    oldVersion: number,
    _newVersion: number | null,
    tx: UpgradeTransaction
): Promise<void> {
    // Decided before any store is created: a database without the lifecycle
    // stores predates them, whatever version number it carries.
    const predatesLifecycle = oldVersion > 0 && !db.objectStoreNames.contains('notifications');

    // 1. Patients store
    if (!db.objectStoreNames.contains('patients')) {
        const patientStore = db.createObjectStore('patients', { keyPath: 'id' });
        patientStore.createIndex('by-sync', 'isSynced');
        patientStore.createIndex('by-timestamp', 'timestamp');
        patientStore.createIndex('by-triage', 'triageStatus');
    }

    // 2. Referrals store
    if (!db.objectStoreNames.contains('referrals')) {
        const refStore = db.createObjectStore('referrals', { keyPath: 'id' });
        refStore.createIndex('by-status', 'status');
        refStore.createIndex('by-priority', 'priority');
        refStore.createIndex('by-from-facility', 'fromFacilityId');
        refStore.createIndex('by-to-facility', 'toFacilityId');
    }

    // 3. Queue store
    if (!db.objectStoreNames.contains('queue')) {
        const qStore = db.createObjectStore('queue', { keyPath: 'id' });
        qStore.createIndex('by-facility', 'facilityId');
        qStore.createIndex('by-status', 'status');
        qStore.createIndex('by-priority', 'priority');
    }

    // 4. Facilities store
    if (!db.objectStoreNames.contains('facilities')) {
        const facStore = db.createObjectStore('facilities', { keyPath: 'id' });
        facStore.createIndex('by-type', 'type');
        facStore.createIndex('by-district', 'district');
    }

    // 5. Medicine Stock store
    if (!db.objectStoreNames.contains('medicineStock')) {
        const medStore = db.createObjectStore('medicineStock', { keyPath: 'id' });
        medStore.createIndex('by-facility', 'facilityId');
        medStore.createIndex('by-status', 'status');
        medStore.createIndex('by-category', 'category');
    }

    // 6. Diagnostics store
    if (!db.objectStoreNames.contains('diagnostics')) {
        const diagStore = db.createObjectStore('diagnostics', { keyPath: 'id' });
        diagStore.createIndex('by-facility', 'facilityId');
        diagStore.createIndex('by-patient', 'patientId');
        diagStore.createIndex('by-status', 'status');
    }

    // 7. Sync queue store
    if (!db.objectStoreNames.contains('syncQueue')) {
        const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
        syncStore.createIndex('by-retry', 'retryCount');
    }

    // 8. Audit log (v3) — accountability trail for every mutation
    if (!db.objectStoreNames.contains('auditLog')) {
        const auditStore = db.createObjectStore('auditLog', { keyPath: 'id' });
        auditStore.createIndex('by-entity', 'entityType');
        auditStore.createIndex('by-timestamp', 'timestamp');
        auditStore.createIndex('by-actor', 'actorId');
    }

    // 9. Appointments (v4) — future-dated booking
    if (!db.objectStoreNames.contains('appointments')) {
        const apptStore = db.createObjectStore('appointments', { keyPath: 'id' });
        apptStore.createIndex('by-facility', 'facilityId');
        apptStore.createIndex('by-date', 'requestedDate');
        apptStore.createIndex('by-patient', 'patientId');
        apptStore.createIndex('by-status', 'status');
    }

    // 10–13 (v5) — referral lifecycle, RBAC and facility capacity
    if (!db.objectStoreNames.contains('notifications')) {
        const n = db.createObjectStore('notifications', { keyPath: 'id' });
        n.createIndex('by-recipient', 'recipient_user_id');
        n.createIndex('by-referral', 'referral_id');
        n.createIndex('by-created', 'created_at');
    }
    if (!db.objectStoreNames.contains('users')) {
        const u = db.createObjectStore('users', { keyPath: 'id' });
        u.createIndex('by-role', 'role');
    }
    if (!db.objectStoreNames.contains('facilityResources')) {
        db.createObjectStore('facilityResources', { keyPath: 'facilityId' });
    }
    if (!db.objectStoreNames.contains('maintenanceLog')) {
        const m = db.createObjectStore('maintenanceLog', { keyPath: 'id' });
        m.createIndex('by-facility', 'facilityId');
        m.createIndex('by-status', 'status');
    }

    // A device from before the lifecycle (v1–v4, or the abandoned build's v5)
    // keeps its own referrals, moved to the new lifecycle, and gains the v5 demo
    // cases. Only the four pre-rework seed referrals are replaced: they are demo
    // data, and the new seed covers every state they did and more.
    if (predatesLifecycle) {
        const refStore = tx.objectStore('referrals');
        // Where each patient was first referred from — the best
        // evidence of where they were registered, for patients
        // captured before registration carried a facility.
        const firstReferredFrom = new Map<string, { at: number; facilityId: string }>();
        let cursor = await refStore.openCursor();
        while (cursor) {
            if (LEGACY_SEED_REFERRAL_IDS.includes(cursor.value.id)) {
                await cursor.delete();
            } else {
                const migrated = normalizeReferral(cursor.value);
                await cursor.update(migrated);
                const at = Date.parse(String(migrated.referredAt)) || 0;
                const seen = firstReferredFrom.get(migrated.patientId);
                if (!seen || at < seen.at) firstReferredFrom.set(migrated.patientId, { at, facilityId: migrated.fromFacilityId });
            }
            cursor = await cursor.continue();
        }
        const patientStore = tx.objectStore('patients');
        for (const seed of SEED_PATIENTS) {
            const existing = await patientStore.get(seed.id);
            await patientStore.put(existing ? { ...existing, registeredAtFacilityId: existing.registeredAtFacilityId ?? seed.registeredAtFacilityId } : seed);
        }
        // Other pre-v5 patients: from their first referral, else
        // their latest visit. With neither, left unset rather than
        // guessed — the DHO still sees them; no facility claims them.
        let pc = await patientStore.openCursor();
        while (pc) {
            const pt: Patient = pc.value;
            if (!pt.registeredAtFacilityId) {
                const visits: VisitRecord[] = Array.isArray(pt.visits) ? pt.visits : [];
                const latestVisit = visits.reduce<VisitRecord | undefined>(
                    (a, b) => (!a || Date.parse(String(b.date)) > Date.parse(String(a.date)) ? b : a), undefined);
                const facilityId = firstReferredFrom.get(pt.id)?.facilityId ?? latestVisit?.facilityId;
                if (facilityId) await pc.update({ ...pt, registeredAtFacilityId: facilityId });
            }
            pc = await pc.continue();
        }
        for (const r of SEED_REFERRALS) await refStore.put(r);
        for (const n of SEED_NOTIFICATIONS) await tx.objectStore('notifications').put(n);
    }

    if (oldVersion > 0 && oldVersion < 6) await retireFacilityIds(tx, predatesLifecycle);
}

/**
 * Point every stored record at current facility ids (see lib/data/facilityIds).
 *
 * Before v5 nothing could edit the facility list — it is seed data, and is
 * replaced outright. From v5 the Super Admin can edit it, so it is replaced
 * only while it still holds a retired id, i.e. while it is the old seed.
 */
async function retireFacilityIds(tx: UpgradeTransaction, replaceFacilityList: boolean): Promise<void> {
    const facilities = tx.objectStore('facilities');
    let staleList = replaceFacilityList;
    for (const retired of Object.keys(RETIRED_FACILITY_IDS)) {
        if (await facilities.get(retired)) {
            staleList = true;
            await facilities.delete(retired);
        }
    }
    if (staleList) for (const f of FACILITY_NETWORK) await facilities.put(f);

    for (const name of FACILITY_REFERENCING_STORES) {
        let cursor = await tx.objectStore(name).openCursor();
        while (cursor) {
            const remapped = remapRetiredFacilityIds(cursor.value);
            if (remapped !== cursor.value) await cursor.update(remapped);
            cursor = await cursor.continue();
        }
    }

    // Bed returns are keyed by facility. One filed under a retired id moves to
    // the current id, unless the current id already has its own.
    const resources = tx.objectStore('facilityResources');
    for (const [retired, current] of Object.entries(RETIRED_FACILITY_IDS)) {
        const orphan = await resources.get(retired);
        if (!orphan) continue;
        await resources.delete(retired);
        if (!(await resources.get(current))) await resources.put({ ...orphan, facilityId: current });
    }
}

/** Seed what is missing: everything on a fresh device, reference data on an upgraded one. */
async function seedDatabase(db: IDBPDatabase<NalamMeshDB>): Promise<void> {
    // Auto-seed if empty
    const patientCount = await db.count('patients');
    if (patientCount === 0) {
        const tx = db.transaction(
            ['patients', 'referrals', 'queue', 'facilities', 'medicineStock', 'diagnostics', 'notifications'],
            'readwrite'
        );

        await Promise.all([
            ...SEED_PATIENTS.map(p => tx.objectStore('patients').put(p)),
            ...SEED_REFERRALS.map(r => tx.objectStore('referrals').put(r)),
            ...SEED_QUEUE.map(q => tx.objectStore('queue').put(q)),
            ...FACILITY_NETWORK.map(f => tx.objectStore('facilities').put(f)),
            ...SEED_MEDICINES.map(m => tx.objectStore('medicineStock').put(m)),
            ...SEED_DIAGNOSTICS.map(d => tx.objectStore('diagnostics').put(d)),
            ...SEED_NOTIFICATIONS.map(n => tx.objectStore('notifications').put(n)),
        ]);
        await tx.done;
        logger.info('Database seeded with authentic Maharashtra healthcare dataset');
    }

    // Reference data added in v5 is seeded independently of patients,
    // so a device upgraded with patients already on it still gets it.
    if ((await db.count('users')) === 0) {
        const tx = db.transaction('users', 'readwrite');
        await Promise.all(SEED_USERS.map(u => tx.store.put(u)));
        await tx.done;
    } else {
        // A directory stored before PINs existed has seeded accounts with no
        // PIN hash, and nobody could sign in on this device. Give each seeded
        // account its shipped hash — only where it has none, so a PIN the
        // Super Admin set is kept.
        const tx = db.transaction('users', 'readwrite');
        for (const seed of SEED_USERS) {
            const stored = await tx.store.get(seed.id);
            if (stored && !stored.pinHash && seed.pinHash) await tx.store.put({ ...stored, pinHash: seed.pinHash });
        }
        await tx.done;
    }
    if ((await db.count('facilityResources')) === 0) {
        const tx = db.transaction(['facilityResources', 'maintenanceLog'], 'readwrite');
        await Promise.all([
            ...SEED_RESOURCES.map(r => tx.objectStore('facilityResources').put(r)),
            ...SEED_MAINTENANCE.map(m => tx.objectStore('maintenanceLog').put(m)),
        ]);
        await tx.done;
    }

    await restoreSeededPlaceNames(db);
}

/**
 * A device seeded by the generic build still says "Primary Health Centre —
 * Block A" and "Village 1". Put the real place names back — only in values
 * still exactly as that build wrote them (lib/data/placeNames), so edits stay.
 * Needs no version change: an up-to-date device reads each store and writes nothing.
 */
async function restoreSeededPlaceNames(db: IDBPDatabase<NalamMeshDB>): Promise<void> {
    const tx = db.transaction(PLACE_NAME_STORES, 'readwrite');
    let restored = 0;
    for (const name of PLACE_NAME_STORES) {
        let cursor = await tx.objectStore(name).openCursor();
        while (cursor) {
            const next = restorePlaceNames(name, cursor.value);
            if (next !== cursor.value) {
                await cursor.update(next);
                restored += 1;
            }
            cursor = await cursor.continue();
        }
    }
    await tx.done;
    if (restored > 0) logger.info('Restored Gadchiroli place names in records seeded by the generic build', { records: restored });
}

// -------------------------------------------------------------
// Patient Operations
// -------------------------------------------------------------

export async function savePatient(patient: Patient): Promise<void> {
    const db = await getDB();
    await db.put('patients', patient);
}

/** Fetch one patient by id. Returns undefined if no such record exists on this device. */
export async function getPatient(id: string): Promise<Patient | undefined> {
    const db = await getDB();
    return await db.get('patients', id);
}

/**
 * Every patient held on this device.
 *
 * Falls back to the seeded cohort when the store is empty so a fresh install has
 * something to show. Once a single real patient is registered the seed is never
 * returned again.
 */
export async function getAllPatients(): Promise<Patient[]> {
    const db = await getDB();
    const patients = await db.getAll('patients');
    return patients.length > 0 ? patients : SEED_PATIENTS;
}

/**
 * Patients not yet acknowledged by a peer, read from the `by-sync` index.
 *
 * This is the backlog a device replays once the mesh relay becomes reachable.
 */
export async function getUnsyncedPatients(): Promise<Patient[]> {
    const db = await getDB();
    return await db.getAllFromIndex('patients', 'by-sync', false as unknown as IDBValidKey);
}

/** Remove one patient from this device. Does not propagate to peers. */
export async function deletePatient(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('patients', id);
}

// -------------------------------------------------------------
// Referral Operations
// -------------------------------------------------------------

export async function getAllReferrals(): Promise<ReferralRecord[]> {
    const db = await getDB();
    const refs = await db.getAll('referrals');
    // Normalised on read as well as on migration: a record that arrived from
    // an older device on the mesh must not reach a screen in the old shape.
    return (refs.length > 0 ? refs : SEED_REFERRALS).map(normalizeReferral);
}

export async function getReferral(id: string): Promise<ReferralRecord | undefined> {
    const db = await getDB();
    const ref = await db.get('referrals', id);
    return ref ? normalizeReferral(ref) : undefined;
}

// -------------------------------------------------------------
// Accountability audit trail
// -------------------------------------------------------------

/** Who an audit row is attributed to. */
export interface AuditActor {
    actorId: string;
    actorRole: string;
    actorName?: string;
    actorFacilityId?: string | null;
}

// The signed-in user of this tab, set at login (see stores/authStore). Until
// then, writes are attributed to "system" rather than to a fabricated clinician.
// Screens acting for someone else (the two-user simulation) pass the actor
// explicitly instead of relying on this.
let currentActor: AuditActor = { actorId: 'system', actorRole: 'SYSTEM' };

export function setCurrentActor(actorId: string, actorRole: string, actorName?: string, actorFacilityId?: string | null): void {
    currentActor = { actorId: actorId || 'system', actorRole: actorRole || 'SYSTEM', actorName, actorFacilityId };
}

/** The staff member currently attributed to writes. Set at login via setCurrentActor(). */
export function getCurrentActor(): AuditActor {
    return currentActor;
}

/**
 * Append one row to the audit trail — who, what, when, and at which facility.
 *
 * Deliberately NEVER throws. By the time this runs the clinical action has already
 * been committed, so a failed audit write must not roll back real care — it is
 * logged to the console and swallowed.
 *
 * Snapshots carry record ids and statuses only. Patient names must not be written
 * here: the audit surface is readable by the District Health Officer, and entityId
 * already resolves to the record for anyone entitled to see it.
 *
 * `id` lets a caller make the row idempotent — a referral event received from the
 * mesh and the same event made here land on one row, not two.
 */
export async function logAudit(
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    action: string,
    snapshot?: { before?: unknown; after?: unknown },
    opts?: { actor?: AuditActor; id?: string; at?: string }
): Promise<void> {
    try {
        const db = await getDB();
        const who = opts?.actor ?? currentActor;
        const entry: AuditLogEntry = {
            id: opts?.id ?? uuidv4(),
            entityType,
            entityId,
            action,
            actorId: who.actorId,
            actorRole: who.actorRole,
            ...(who.actorName ? { actorName: who.actorName } : {}),
            actorFacilityId: who.actorFacilityId ?? null,
            timestamp: opts?.at ?? new Date().toISOString(),
            ...(snapshot?.before !== undefined ? { before: JSON.stringify(snapshot.before) } : {}),
            ...(snapshot?.after !== undefined ? { after: JSON.stringify(snapshot.after) } : {}),
        };
        await db.put('auditLog', entry);
    } catch (error) {
        console.error('Audit log write failed (clinical action already applied):', error);
    }
}

/** Recent audit entries, newest first. */
export async function getAuditLog(limit = 200): Promise<AuditLogEntry[]> {
    const db = await getDB();
    const all = await db.getAll('auditLog');
    return all
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
}

/** An audit row for one referral lifecycle event, keyed by the event so it is written once. */
function auditReferralEvent(ref: ReferralRecord, event: ReferralEvent): Promise<void> {
    return logAudit(
        'REFERRAL',
        ref.id,
        event.action === 'CREATE' ? 'CREATE' : `${event.action} → ${event.toStatus}`,
        {
            ...(event.fromStatus ? { before: { status: event.fromStatus } } : {}),
            after: {
                status: event.toStatus,
                from: ref.fromFacilityId,
                to: ref.toFacilityId,
                priority: ref.priority,
                ...(event.note ? { note: event.note.slice(0, 140) } : {}),
            },
        },
        {
            id: `audit:${event.id}`,
            at: event.at,
            actor: {
                actorId: event.actor.userId,
                actorRole: event.actor.role,
                actorName: event.actor.name,
                actorFacilityId: event.actor.facilityId,
            },
        }
    );
}

/**
 * Persist a referral and audit every lifecycle event it carries that this
 * device has not recorded before.
 *
 * One writer for both paths — an action taken here, and an update received
 * from the mesh — so the audit trail on every device holds the same history
 * regardless of where each step was taken. Audit rows are keyed by event id,
 * so re-saving the same referral never duplicates one.
 */
export async function saveReferral(referral: ReferralRecord): Promise<void> {
    const db = await getDB();
    const previous: ReferralRecord | undefined = await db.get('referrals', referral.id);
    await db.put('referrals', referral);
    const known = new Set((previous?.timeline ?? []).map((e: ReferralEvent) => e.id));
    for (const event of referral.timeline) {
        if (!known.has(event.id)) await auditReferralEvent(referral, event);
    }
    const knownComments = new Set((previous?.comments ?? []).map((c: { id: string }) => c.id));
    for (const c of referral.comments) {
        if (knownComments.has(c.id)) continue;
        await logAudit('REFERRAL', referral.id, 'COMMENT', { after: { length: c.text.length } }, {
            id: `audit:${c.id}`,
            at: c.at,
            actor: { actorId: c.actor.userId, actorRole: c.actor.role, actorName: c.actor.name, actorFacilityId: c.actor.facilityId },
        });
    }
}

// -------------------------------------------------------------
// Notifications
// -------------------------------------------------------------

/**
 * Store notifications, keeping any already on this device as they are.
 *
 * The same notification can arrive twice — once made here, once echoed back
 * from the mesh. Overwriting would flip a notification the user already read
 * back to unread, so an existing row always wins.
 */
export async function saveNotifications(rows: readonly NotificationRecord[]): Promise<NotificationRecord[]> {
    if (rows.length === 0) return [];
    const db = await getDB();
    const tx = db.transaction('notifications', 'readwrite');
    const added: NotificationRecord[] = [];
    for (const row of rows) {
        if (await tx.store.get(row.id)) continue;
        await tx.store.put(row);
        added.push(row);
    }
    await tx.done;
    return added;
}

export async function getNotifications(): Promise<NotificationRecord[]> {
    const db = await getDB();
    const all = await db.getAll('notifications');
    return all.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}

export async function markNotificationsRead(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDB();
    const tx = db.transaction('notifications', 'readwrite');
    for (const id of ids) {
        const row = await tx.store.get(id);
        if (row && !row.is_read) await tx.store.put({ ...row, is_read: true });
    }
    await tx.done;
}

// -------------------------------------------------------------
// Staff directory
// -------------------------------------------------------------

export async function getUsers(): Promise<StaffUser[]> {
    const db = await getDB();
    const users = await db.getAll('users');
    return users.length > 0 ? users : SEED_USERS;
}

/**
 * Store a change that was made — and audited — on another tab or device.
 *
 * Deliberately writes no audit row: attributing it here would name this
 * device's user as the author of someone else's change. Referral events are
 * the exception (see saveReferral), because each one carries its own actor.
 */
export async function storeFromMesh(
    store: 'users' | 'facilityResources' | 'maintenanceLog',
    row: StaffUser | FacilityResources | MaintenanceTicket
): Promise<void> {
    const db = await getDB();
    // The union is narrowed by the store name at every call site.
    await db.put(store, row as never);
}

export async function saveUser(user: StaffUser): Promise<void> {
    const db = await getDB();
    const existing = await db.get('users', user.id);
    await db.put('users', user);
    await logAudit('USER', user.id, existing ? 'UPDATE' : 'CREATE', {
        ...(existing ? { before: { role: existing.role, facility: existing.facilityId, active: existing.active } } : {}),
        after: { role: user.role, facility: user.facilityId, active: user.active },
    });
}

// -------------------------------------------------------------
// Facility resources & maintenance
// -------------------------------------------------------------

export async function getAllResources(): Promise<FacilityResources[]> {
    const db = await getDB();
    const rows = await db.getAll('facilityResources');
    return rows.length > 0 ? rows : SEED_RESOURCES;
}

export async function saveResources(resources: FacilityResources, change: string): Promise<void> {
    const db = await getDB();
    const existing = await db.get('facilityResources', resources.facilityId);
    await db.put('facilityResources', resources);
    await logAudit('RESOURCES', resources.facilityId, change, {
        ...(existing ? { before: summariseResources(existing) } : {}),
        after: summariseResources(resources),
    });
}

function summariseResources(r: FacilityResources) {
    return {
        beds: r.wards.map(w => `${w.ward}:${w.occupied}/${w.total}`).join(' '),
        staff: r.staffOnDuty.reduce((n, s) => n + s.count, 0),
    };
}

/**
 * Move a ward's occupancy by one — admission or discharge.
 *
 * Throws if the facility or ward is unknown: a discharge that silently fails
 * to free its bed leaves the Command Center showing a full hospital that is
 * not, and an admission that silently fails shows a bed that is taken as free.
 */
export async function adjustOccupancy(
    facilityId: string,
    ward: WardType,
    delta: 1 | -1,
    actor: AuditActor,
    referralId: string
): Promise<FacilityResources> {
    const db = await getDB();
    const stored: FacilityResources | undefined = await db.get('facilityResources', facilityId);
    const res = stored ?? SEED_RESOURCES.find(r => r.facilityId === facilityId);
    if (!res) throw new DatabaseError(`No resource record for ${facilityId} — bed count not changed`);
    const line = res.wards.find(w => w.ward === ward);
    if (!line) throw new DatabaseError(`${facilityId} has no ${ward} ward — bed count not changed`);
    const before = line.occupied;
    const next: FacilityResources = {
        ...res,
        wards: res.wards.map(w => (w.ward === ward ? { ...w, occupied: Math.max(0, w.occupied + delta) } : w)),
        updatedAt: new Date().toISOString(),
        updatedBy: actor.actorName ?? actor.actorId,
    };
    await db.put('facilityResources', next);
    await logAudit('RESOURCES', facilityId, delta > 0 ? 'ADMISSION → BED OCCUPIED' : 'DISCHARGE → BED FREED', {
        before: { ward, occupied: before },
        after: { ward, occupied: Math.max(0, before + delta), referral: referralId },
    }, { actor });
    return next;
}

export async function getMaintenanceTickets(): Promise<MaintenanceTicket[]> {
    const db = await getDB();
    const rows = await db.getAll('maintenanceLog');
    return (rows.length > 0 ? rows : SEED_MAINTENANCE).sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt));
}

export async function saveMaintenanceTicket(ticket: MaintenanceTicket, change: string): Promise<void> {
    const db = await getDB();
    const existing = await db.get('maintenanceLog', ticket.id);
    await db.put('maintenanceLog', ticket);
    await logAudit('MAINTENANCE', ticket.id, change, {
        ...(existing ? { before: { status: existing.status } } : {}),
        after: {
            facility: ticket.facilityId,
            target: ticket.target.kind === 'BEDS' ? `${ticket.target.ward} beds` : ticket.target.equipment,
            units: ticket.units,
            status: ticket.status,
        },
    });
}

// -------------------------------------------------------------
// Appointment Operations
// -------------------------------------------------------------

export async function getAppointments(facilityId?: string): Promise<Appointment[]> {
    const db = await getDB();
    const all = await db.getAll('appointments');
    return facilityId ? all.filter(a => a.facilityId === facilityId) : all;
}

/** Persist a citizen booking and record it in the audit trail. */
export async function saveAppointment(appt: Appointment): Promise<void> {
    const db = await getDB();
    await db.put('appointments', appt);
    await logAudit('APPOINTMENT', appt.id, 'BOOK', {
        after: { facility: appt.facilityName, date: appt.requestedDate, slot: appt.slot, dept: appt.department },
    });
}

/**
 * Move an appointment through its lifecycle, optionally linking the queue token
 * created when the patient arrives. Throws if the appointment is not found.
 */
export async function updateAppointmentStatus(
    id: string,
    status: Appointment['status'],
    patch?: { tokenId?: string }
): Promise<void> {
    const db = await getDB();
    const appt = await db.get('appointments', id);
    // Throw on missing, like the referral/queue mutations: a booking that silently fails
    // to change must not read as confirmed/checked-in on screen while stored otherwise.
    if (!appt) {
        throw new DatabaseError(`Appointment ${id} not found — status not updated to ${status}`);
    }
    const previousStatus = appt.status;
    appt.status = status;
    if (patch?.tokenId) appt.tokenId = patch.tokenId;
    await db.put('appointments', appt);
    await logAudit('APPOINTMENT', id, `STATUS → ${status}`, {
        before: { status: previousStatus },
        after: { status, ...(patch?.tokenId ? { token: patch.tokenId } : {}) },
    });
}

// -------------------------------------------------------------
// Queue Operations
// -------------------------------------------------------------

export async function getQueueEntries(facilityId?: string): Promise<QueueEntry[]> {
    const db = await getDB();
    const entries = await db.getAll('queue');
    const source = entries.length > 0 ? entries : SEED_QUEUE;
    if (!facilityId) return source;
    return source.filter(q => q.facilityId === facilityId);
}

/** Persist one OPD queue token. */
export async function saveQueueEntry(entry: QueueEntry): Promise<void> {
    const db = await getDB();
    await db.put('queue', entry);
}

/**
 * Change a queue token's state — called, completed, or cancelled.
 *
 * Stamps `calledAt` on transition to CALLED. Wait times elsewhere in the app are
 * computed from that timestamp rather than from a stored estimate, which is why it
 * must be written here and not derived later.
 */
export async function updateQueueStatus(
    id: string,
    status: QueueEntry['status'],
    doctor?: string
): Promise<void> {
    const db = await getDB();
    const q = await db.get('queue', id);
    // Throw rather than return quietly: a token silently failing to move means the board and
    // the stored queue disagree about who has been seen.
    if (!q) {
        throw new DatabaseError(`Queue entry ${id} not found — status not updated to ${status}`);
    }
    const previousStatus = q.status;
    q.status = status;
    if (doctor) q.consultingDoctor = doctor;
    if (status === 'IN_CONSULTATION') q.calledAt = new Date().toISOString();
    if (status === 'COMPLETED') q.completedAt = new Date().toISOString();
    await db.put('queue', q);
    // Token number only, never the patient's name: the audit store is a separate,
    // DHO-readable surface, and entityId already resolves to the queue record that
    // holds the identity. Copying PII across widens exposure for no added traceability.
    await logAudit('QUEUE', id, `STATUS → ${status}`, {
        before: { status: previousStatus },
        after: { status, token: q.tokenNumber },
    });
}

// -------------------------------------------------------------
// Medicine & Diagnostics Operations
// -------------------------------------------------------------

export async function getAllMedicines(): Promise<MedicineStockItem[]> {
    const db = await getDB();
    const meds = await db.getAll('medicineStock');
    return meds.length > 0 ? meds : SEED_MEDICINES;
}

/**
 * Upsert a medicine stock line, auditing the quantity change.
 *
 * Reads the existing row first so the audit entry can record the before/after
 * balance rather than only the new value.
 */
export async function saveMedicine(medicine: MedicineStockItem): Promise<void> {
    const db = await getDB();
    const existing = await db.get('medicineStock', medicine.id);
    await db.put('medicineStock', medicine);
    await logAudit('MEDICINE', medicine.id, existing ? 'STOCK_UPDATE' : 'STOCK_CREATE', {
        ...(existing ? { before: { stock: existing.currentStock, status: existing.status } } : {}),
        after: { name: medicine.name, stock: medicine.currentStock, status: medicine.status },
    });
}

/** Every diagnostic order on this device, falling back to seed data when empty. */
export async function getAllDiagnostics(): Promise<DiagnosticOrder[]> {
    const db = await getDB();
    const diags = await db.getAll('diagnostics');
    return diags.length > 0 ? diags : SEED_DIAGNOSTICS;
}

/** Persist a diagnostic order or its result. */
export async function saveDiagnostic(diagnostic: DiagnosticOrder): Promise<void> {
    const db = await getDB();
    await db.put('diagnostics', diagnostic);
}

// -------------------------------------------------------------
// Facilities
// -------------------------------------------------------------

export async function getAllFacilities(): Promise<Facility[]> {
    const db = await getDB();
    const facs = await db.getAll('facilities');
    return facs.length > 0 ? facs : FACILITY_NETWORK;
}

/** Super Admin edits to a facility's directory entry. */
export async function saveFacility(facility: Facility): Promise<void> {
    const db = await getDB();
    const existing = await db.get('facilities', facility.id);
    await db.put('facilities', facility);
    await logAudit('FACILITY', facility.id, existing ? 'UPDATE' : 'CREATE', {
        ...(existing ? { before: { name: existing.name, contact: existing.contact, online: existing.isOnline } } : {}),
        after: { name: facility.name, contact: facility.contact, online: facility.isOnline },
    });
}

// -------------------------------------------------------------
// Sync Queue & Reset
// -------------------------------------------------------------

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
    const db = await getDB();
    await db.put('syncQueue', item);
}

/**
 * Everything still waiting to reach the cloud, oldest change first.
 *
 * Order matters: uploads are applied last-write-wins on the server, so replaying
 * them out of order could land an older edit on top of a newer one.
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await getDB();
    const items = await db.getAll('syncQueue');
    return items.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

/** Drop an item once the cloud has acknowledged it (or permanently refused it). */
export async function removeFromSyncQueue(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('syncQueue', id);
}

/** How many records are still waiting on connectivity. Shown to the worker. */
export async function getSyncQueueDepth(): Promise<number> {
    const db = await getDB();
    return db.count('syncQueue');
}

/**
 * Clear patients, referrals, their notifications and the queue in one transaction.
 *
 * Used by the demo reset. Facilities, stock and diagnostics are left intact because
 * they are reference data rather than encounter data.
 */
export async function clearAllPatients(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['patients', 'referrals', 'queue', 'notifications'], 'readwrite');
    await tx.objectStore('patients').clear();
    await tx.objectStore('referrals').clear();
    await tx.objectStore('queue').clear();
    await tx.objectStore('notifications').clear();
    await tx.done;
}

/**
 * Restore every store to its seeded state in a single transaction.
 *
 * Wired to the mesh `data:reset` broadcast so a demo can be returned to a known
 * starting point across all connected devices at once.
 */
export async function resetToDefaultSeed(): Promise<void> {
    const db = await getDB();
    const stores = [
        'patients', 'referrals', 'queue', 'facilities', 'medicineStock', 'diagnostics',
        'notifications', 'users', 'facilityResources', 'maintenanceLog',
    ] as const;
    const tx = db.transaction([...stores], 'readwrite');
    await Promise.all(stores.map(name => tx.objectStore(name).clear()));
    await Promise.all([
        ...SEED_PATIENTS.map(p => tx.objectStore('patients').put(p)),
        ...SEED_REFERRALS.map(r => tx.objectStore('referrals').put(r)),
        ...SEED_QUEUE.map(q => tx.objectStore('queue').put(q)),
        ...FACILITY_NETWORK.map(f => tx.objectStore('facilities').put(f)),
        ...SEED_MEDICINES.map(m => tx.objectStore('medicineStock').put(m)),
        ...SEED_DIAGNOSTICS.map(d => tx.objectStore('diagnostics').put(d)),
        ...SEED_NOTIFICATIONS.map(n => tx.objectStore('notifications').put(n)),
        ...SEED_USERS.map(u => tx.objectStore('users').put(u)),
        ...SEED_RESOURCES.map(r => tx.objectStore('facilityResources').put(r)),
        ...SEED_MAINTENANCE.map(m => tx.objectStore('maintenanceLog').put(m)),
    ]);
    await tx.done;
}

// ── inspection ───────────────────────────────────────────────────────────────

/** One object store as the Data Inspector screen shows it. */
export interface StoreSnapshot {
    /** The object store's name, exactly as IndexedDB holds it. */
    name: string;
    /** Every row in the store, not just the ones returned below. */
    count: number;
    /** The newest rows, capped. Untyped on purpose — see inspectStores. */
    rows: unknown[];
    /** True when `count` exceeds what `rows` carries. */
    truncated: boolean;
}

/**
 * Read every object store in this device's database.
 *
 * For the Data Inspector screen, whose claim is "this is what is on the device,
 * right now, with no network". Two deliberate choices:
 *
 *   - The store list comes from `db.objectStoreNames`, never from a hardcoded
 *     array. A store added to the schema later then appears here on its own; a
 *     hardcoded list would leave it invisible, and an inspector that silently
 *     omits data is worse than no inspector at all.
 *   - Rows come back as `unknown[]`. Nine stores hold nine unrelated shapes, and
 *     the screen renders them generically. Pretending to a single row type here
 *     would only push a cast somewhere less visible.
 *
 * Unlike getAllPatients this never substitutes seed data for an empty store: an
 * empty store is a fact the inspector has to be able to report.
 */
export async function inspectStores(limitPerStore = 25): Promise<StoreSnapshot[]> {
    const db = await getDB();
    const names = Array.from(db.objectStoreNames) as Array<keyof NalamMeshDB>;

    const snapshots = await Promise.all(
        names.map(async (name) => {
            const count = await db.count(name);
            const rows = await db.getAll(name, undefined, limitPerStore);
            return {
                name: String(name),
                count,
                rows: rows as unknown[],
                truncated: count > rows.length,
            };
        })
    );

    return snapshots.sort((a, b) => a.name.localeCompare(b.name));
}
