/**
 * IndexedDB wrapper for offline rural public healthcare data storage
 * Version 2: Supports longitudinal patients, visits, referral pipeline, queue tokens, medicine stock, and diagnostics
 * @module lib/db
 */

import { openDB, IDBPDatabase } from 'idb';
import { Patient, SyncQueueItem, ReferralRecord } from '@/types/patient';
import { QueueEntry, MedicineStockItem, DiagnosticOrder, Facility, AuditLogEntry } from '@/types/facility';
import { Appointment } from '@/types/appointment';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { retry } from '@/lib/utils/retry';
import {
    SEED_PATIENTS,
    SEED_REFERRALS,
    SEED_QUEUE,
    SEED_MEDICINES,
    SEED_DIAGNOSTICS,
    MAHARASHTRA_FACILITIES
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
};

let dbInstance: IDBPDatabase<NalamMeshDB> | null = null;

export class DatabaseError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'DatabaseError';
    }
}

/**
 * Initialize IndexedDB and seed with authentic Maharashtra datasets if fresh
 */
export async function getDB(): Promise<IDBPDatabase<NalamMeshDB>> {
    if (dbInstance) return dbInstance;

    try {
        dbInstance = await retry(
            async () => {
                const db = await openDB<NalamMeshDB>('nalammesh-rural-db', 4, {
                    upgrade(db, oldVersion, newVersion, tx) {
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
                    },
                });

                // Auto-seed if empty
                const patientCount = await db.count('patients');
                if (patientCount === 0) {
                    const tx = db.transaction(
                        ['patients', 'referrals', 'queue', 'facilities', 'medicineStock', 'diagnostics'],
                        'readwrite'
                    );

                    await Promise.all([
                        ...SEED_PATIENTS.map(p => tx.objectStore('patients').put(p)),
                        ...SEED_REFERRALS.map(r => tx.objectStore('referrals').put(r)),
                        ...SEED_QUEUE.map(q => tx.objectStore('queue').put(q)),
                        ...MAHARASHTRA_FACILITIES.map(f => tx.objectStore('facilities').put(f)),
                        ...SEED_MEDICINES.map(m => tx.objectStore('medicineStock').put(m)),
                        ...SEED_DIAGNOSTICS.map(d => tx.objectStore('diagnostics').put(d)),
                    ]);
                    await tx.done;
                    logger.info('Database seeded with authentic Maharashtra healthcare dataset');
                }

                return db;
            },
            { maxRetries: 3, initialDelay: 500, maxDelay: 3000 }
        );

        return dbInstance;
    } catch (error) {
        logger.error('Failed to initialize IndexedDB', { error });
        throw new DatabaseError('Failed to initialize database', error);
    }
}

// -------------------------------------------------------------
// Patient Operations
// -------------------------------------------------------------

export async function savePatient(patient: Patient): Promise<void> {
    const db = await getDB();
    await db.put('patients', patient);
}

export async function getPatient(id: string): Promise<Patient | undefined> {
    const db = await getDB();
    return await db.get('patients', id);
}

export async function getAllPatients(): Promise<Patient[]> {
    const db = await getDB();
    const patients = await db.getAll('patients');
    return patients.length > 0 ? patients : SEED_PATIENTS;
}

export async function getUnsyncedPatients(): Promise<Patient[]> {
    const db = await getDB();
    return await db.getAllFromIndex('patients', 'by-sync', false as unknown as IDBValidKey);
}

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
    return refs.length > 0 ? refs : SEED_REFERRALS;
}

// -------------------------------------------------------------
// Accountability audit trail
// -------------------------------------------------------------

// The acting user for audit attribution. Set at login (see stores/authStore); until
// then, writes are attributed to "system" rather than to a fabricated clinician.
let currentActor: { actorId: string; actorRole: string } = { actorId: 'system', actorRole: 'SYSTEM' };

export function setCurrentActor(actorId: string, actorRole: string): void {
    currentActor = { actorId: actorId || 'system', actorRole: actorRole || 'SYSTEM' };
}

export function getCurrentActor(): { actorId: string; actorRole: string } {
    return currentActor;
}

/**
 * Record one audit entry. Deliberately non-throwing: the primary clinical write has
 * already succeeded by the time this is called, and a failed audit write must never
 * roll back or block patient care — the failure is logged, not propagated.
 */
export async function logAudit(
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    action: string,
    snapshot?: { before?: unknown; after?: unknown }
): Promise<void> {
    try {
        const db = await getDB();
        const entry: AuditLogEntry = {
            id: uuidv4(),
            entityType,
            entityId,
            action,
            actorId: currentActor.actorId,
            actorRole: currentActor.actorRole,
            timestamp: new Date().toISOString(),
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

export async function saveReferral(referral: ReferralRecord): Promise<void> {
    const db = await getDB();
    await db.put('referrals', referral);
    await logAudit('REFERRAL', referral.id, 'CREATE', {
        after: { status: referral.status, to: referral.toFacilityName, priority: referral.priority },
    });
}

export async function updateReferralStatus(
    id: string,
    status: ReferralRecord['status'],
    opts?: { notes?: string; ambulanceVehicleNo?: string; etaMinutes?: number }
): Promise<void> {
    const db = await getDB();
    const ref = await db.get('referrals', id);
    // Throw rather than return quietly: the caller reports success to a clinician on
    // resolve, so a silent no-op here means a referral shows as COMPLETED on screen
    // while the stored record still says otherwise.
    if (!ref) {
        throw new DatabaseError(`Referral ${id} not found — status not updated to ${status}`);
    }
    const previousStatus = ref.status;
    const now = new Date().toISOString();
    ref.status = status;
    ref.lastUpdatedAt = now;
    if (opts?.notes) ref.notes = opts.notes;
    if (opts?.ambulanceVehicleNo) ref.ambulanceVehicleNo = opts.ambulanceVehicleNo;
    if (typeof opts?.etaMinutes === 'number') ref.etaMinutes = opts.etaMinutes;
    if (status === 'IN_TRANSIT' && !ref.inTransitAt) ref.inTransitAt = now;
    if (status === 'COMPLETED') ref.completedAt = now;
    await db.put('referrals', ref);
    await logAudit('REFERRAL', id, `STATUS → ${status}`, {
        before: { status: previousStatus },
        after: { status, ...(opts?.ambulanceVehicleNo ? { vehicle: opts.ambulanceVehicleNo } : {}) },
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

export async function saveAppointment(appt: Appointment): Promise<void> {
    const db = await getDB();
    await db.put('appointments', appt);
    await logAudit('APPOINTMENT', appt.id, 'BOOK', {
        after: { facility: appt.facilityName, date: appt.requestedDate, slot: appt.slot, dept: appt.department },
    });
}

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

export async function saveQueueEntry(entry: QueueEntry): Promise<void> {
    const db = await getDB();
    await db.put('queue', entry);
}

export async function updateQueueStatus(
    id: string,
    status: QueueEntry['status'],
    doctor?: string
): Promise<void> {
    const db = await getDB();
    const q = await db.get('queue', id);
    // See updateReferralStatus: a token silently failing to move means the board and
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
    await logAudit('QUEUE', id, `STATUS → ${status}`, {
        before: { status: previousStatus },
        after: { status, token: q.tokenNumber, patient: q.patientName },
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

export async function saveMedicine(medicine: MedicineStockItem): Promise<void> {
    const db = await getDB();
    const existing = await db.get('medicineStock', medicine.id);
    await db.put('medicineStock', medicine);
    await logAudit('MEDICINE', medicine.id, existing ? 'STOCK_UPDATE' : 'STOCK_CREATE', {
        ...(existing ? { before: { stock: existing.currentStock, status: existing.status } } : {}),
        after: { name: medicine.name, stock: medicine.currentStock, status: medicine.status },
    });
}

export async function getAllDiagnostics(): Promise<DiagnosticOrder[]> {
    const db = await getDB();
    const diags = await db.getAll('diagnostics');
    return diags.length > 0 ? diags : SEED_DIAGNOSTICS;
}

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
    return facs.length > 0 ? facs : MAHARASHTRA_FACILITIES;
}

// -------------------------------------------------------------
// Sync Queue & Reset
// -------------------------------------------------------------

export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
    const db = await getDB();
    await db.put('syncQueue', item);
}

export async function clearAllPatients(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(['patients', 'referrals', 'queue'], 'readwrite');
    await tx.objectStore('patients').clear();
    await tx.objectStore('referrals').clear();
    await tx.objectStore('queue').clear();
    await tx.done;
}

export async function resetToDefaultSeed(): Promise<void> {
    const db = await getDB();
    const tx = db.transaction(
        ['patients', 'referrals', 'queue', 'facilities', 'medicineStock', 'diagnostics'],
        'readwrite'
    );
    await Promise.all([
        tx.objectStore('patients').clear(),
        tx.objectStore('referrals').clear(),
        tx.objectStore('queue').clear(),
        tx.objectStore('facilities').clear(),
        tx.objectStore('medicineStock').clear(),
        tx.objectStore('diagnostics').clear(),
    ]);
    await Promise.all([
        ...SEED_PATIENTS.map(p => tx.objectStore('patients').put(p)),
        ...SEED_REFERRALS.map(r => tx.objectStore('referrals').put(r)),
        ...SEED_QUEUE.map(q => tx.objectStore('queue').put(q)),
        ...MAHARASHTRA_FACILITIES.map(f => tx.objectStore('facilities').put(f)),
        ...SEED_MEDICINES.map(m => tx.objectStore('medicineStock').put(m)),
        ...SEED_DIAGNOSTICS.map(d => tx.objectStore('diagnostics').put(d)),
    ]);
    await tx.done;
}
