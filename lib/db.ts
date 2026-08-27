/**
 * IndexedDB wrapper for offline rural public healthcare data storage
 * Version 2: Supports longitudinal patients, visits, referral pipeline, queue tokens, medicine stock, and diagnostics
 * @module lib/db
 */

import { openDB, IDBPDatabase } from 'idb';
import { Patient, SyncQueueItem, ReferralRecord } from '@/types/patient';
import { QueueEntry, MedicineStockItem, DiagnosticOrder, Facility } from '@/types/facility';
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
                const db = await openDB<NalamMeshDB>('nalammesh-rural-db', 2, {
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

export async function saveReferral(referral: ReferralRecord): Promise<void> {
    const db = await getDB();
    await db.put('referrals', referral);
}

export async function updateReferralStatus(
    id: string,
    status: ReferralRecord['status'],
    notes?: string
): Promise<void> {
    const db = await getDB();
    const ref = await db.get('referrals', id);
    if (ref) {
        ref.status = status;
        if (notes) ref.notes = notes;
        if (status === 'COMPLETED') ref.completedAt = new Date().toISOString();
        await db.put('referrals', ref);
    }
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
    if (q) {
        q.status = status;
        if (doctor) q.consultingDoctor = doctor;
        if (status === 'IN_CONSULTATION') q.calledAt = new Date().toISOString();
        if (status === 'COMPLETED') q.completedAt = new Date().toISOString();
        await db.put('queue', q);
    }
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
    await db.put('medicineStock', medicine);
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
