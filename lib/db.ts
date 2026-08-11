/**
 * IndexedDB wrapper for offline patient data storage
 * Provides CRUD operations with automatic versioning, error handling, and retry logic
 * @module lib/db
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Patient, SyncQueueItem } from '@/types/patient';
import { logger } from '@/lib/logger';
import { retry, isNetworkError } from '@/lib/utils/retry';
import { DATABASE_CONFIG } from '@/lib/constants/app';

type NalamMeshDB = {
    patients: {
        key: string;
        value: Patient;
        indexes: { 'by-sync': boolean; 'by-timestamp': Date };
    };
    syncQueue: {
        key: string;
        value: SyncQueueItem;
        indexes: { 'by-retry': number };
    };
};

let dbInstance: IDBPDatabase<NalamMeshDB> | null = null;

/**
 * DatabaseError class for typed error handling
 */
export class DatabaseError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message);
        this.name = 'DatabaseError';
    }
}

/**
 * Get or create IndexedDB instance with retry logic
 * @returns Promise resolving to database instance
 * @throws {DatabaseError} if database cannot be opened after retries
 */
export async function getDB(): Promise<IDBPDatabase<NalamMeshDB>> {
    if (dbInstance) return dbInstance;

    try {
        dbInstance = await retry(
            async () => {
                const db = await openDB<NalamMeshDB>(
                    DATABASE_CONFIG.NAME,
                    DATABASE_CONFIG.VERSION,
                    {
                        upgrade(db) {
                            // Patients store
                            if (!db.objectStoreNames.contains(DATABASE_CONFIG.STORES.PATIENTS)) {
                                const patientStore = db.createObjectStore(DATABASE_CONFIG.STORES.PATIENTS, {
                                    keyPath: 'id'
                                });
                                patientStore.createIndex('by-sync', 'isSynced');
                                patientStore.createIndex('by-timestamp', 'timestamp');
                                logger.info('Created patients object store');
                            }

                            // Sync queue store
                            if (!db.objectStoreNames.contains(DATABASE_CONFIG.STORES.SYNC_QUEUE)) {
                                const syncStore = db.createObjectStore(DATABASE_CONFIG.STORES.SYNC_QUEUE, {
                                    keyPath: 'id'
                                });
                                syncStore.createIndex('by-retry', 'retryCount');
                                logger.info('Created sync queue object store');
                            }
                        },
                    }
                );

                logger.info('IndexedDB initialized successfully');
                return db;
            },
            {
                maxRetries: 3,
                initialDelay: 1000,
                maxDelay: 5000,
                backoff: 'exponential',
            }
        );

        return dbInstance;
    } catch (error) {
        logger.error('Failed to initialize IndexedDB', { error });
        throw new DatabaseError('Failed to initialize database', error);
    }
}

/**
 * Save patient record to IndexedDB
 * @param patient - Patient object to save
 * @throws {DatabaseError} if save operation fails
 */
export async function savePatient(patient: Patient): Promise<void> {
    try {
        const db = await getDB();
        await db.put(DATABASE_CONFIG.STORES.PATIENTS, patient);

        logger.info('Patient saved successfully', {
            patientId: patient.id,
            triageStatus: patient.triageStatus,
        });
    } catch (error) {
        logger.error('Failed to save patient', {
            patientId: patient.id,
            error,
        });
        throw new DatabaseError('Failed to save patient record', error);
    }
}

/**
 * Get single patient by ID
 * @param id - Patient UUID
 * @returns Patient object or undefined if not found
 */
export async function getPatient(id: string): Promise<Patient | undefined> {
    try {
        const db = await getDB();
        const patient = await db.get(DATABASE_CONFIG.STORES.PATIENTS, id);

        if (patient) {
            logger.debug('Patient retrieved', { patientId: id });
        }

        return patient;
    } catch (error) {
        logger.error('Failed to get patient', { patientId: id, error });
        throw new DatabaseError('Failed to retrieve patient record', error);
    }
}

/**
 * Get all patient records
 * @returns Array of all patients
 */
export async function getAllPatients(): Promise<Patient[]> {
    try {
        const db = await getDB();
        const patients = await db.getAll(DATABASE_CONFIG.STORES.PATIENTS);

        logger.debug('Retrieved all patients', { count: patients.length });
        return patients;
    } catch (error) {
        logger.error('Failed to get all patients', { error });
        throw new DatabaseError('Failed to retrieve patient records', error);
    }
}

/**
 * Get unsynced patient records
 * @returns Array of patients with isSynced=false
 */
export async function getUnsyncedPatients(): Promise<Patient[]> {
    try {
        const db = await getDB();
        const patients = await db.getAllFromIndex(
            DATABASE_CONFIG.STORES.PATIENTS,
            'by-sync',
            false as unknown as IDBValidKey
        );

        logger.debug('Retrieved unsynced patients', { count: patients.length });
        return patients;
    } catch (error) {
        logger.error('Failed to get unsynced patients', { error });
        throw new DatabaseError('Failed to retrieve unsynced records', error);
    }
}

/**
 * Delete patient record
 * @param id - Patient UUID to delete
 */
export async function deletePatient(id: string): Promise<void> {
    try {
        const db = await getDB();
        await db.delete(DATABASE_CONFIG.STORES.PATIENTS, id);

        logger.info('Patient deleted', { patientId: id });
    } catch (error) {
        logger.error('Failed to delete patient', { patientId: id, error });
        throw new DatabaseError('Failed to delete patient record', error);
    }
}

/**
 * Add item to sync queue
 * @param item - Sync queue item
 */
export async function addToSyncQueue(item: SyncQueueItem): Promise<void> {
    try {
        const db = await getDB();
        await db.put(DATABASE_CONFIG.STORES.SYNC_QUEUE, item);

        logger.info('Added to sync queue', {
            queueId: item.id,
            patientId: item.patientId,
        });
    } catch (error) {
        logger.error('Failed to add to sync queue', { error });
        throw new DatabaseError('Failed to queue sync operation', error);
    }
}

/**
 * Get all items in sync queue
 * @returns Array of sync queue items
 */
export async function getSyncQueue(): Promise<SyncQueueItem[]> {
    try {
        const db = await getDB();
        return await db.getAll(DATABASE_CONFIG.STORES.SYNC_QUEUE);
    } catch (error) {
        logger.error('Failed to get sync queue', { error });
        throw new DatabaseError('Failed to retrieve sync queue', error);
    }
}

/**
 * Remove item from sync queue
 * @param id - Sync queue item ID
 */
export async function removeSyncQueueItem(id: string): Promise<void> {
    try {
        const db = await getDB();
        await db.delete(DATABASE_CONFIG.STORES.SYNC_QUEUE, id);

        logger.debug('Removed from sync queue', { queueId: id });
    } catch (error) {
        logger.error('Failed to remove from sync queue', { queueId: id, error });
        throw new DatabaseError('Failed to remove from sync queue', error);
    }
}

/**
 * Clear all synced patient records
 * @returns Number of records deleted
 */
export async function clearSyncedPatients(): Promise<number> {
    try {
        const db = await getDB();
        const synced = await db.getAllFromIndex(
            DATABASE_CONFIG.STORES.PATIENTS,
            'by-sync',
            true as unknown as IDBValidKey
        );

        const tx = db.transaction(DATABASE_CONFIG.STORES.PATIENTS, 'readwrite');
        await Promise.all(synced.map(patient => tx.store.delete(patient.id)));
        await tx.done;

        logger.info('Cleared synced patients', { count: synced.length });
        return synced.length;
    } catch (error) {
        logger.error('Failed to clear synced patients', { error });
        throw new DatabaseError('Failed to clear synced records', error);
    }
}

/**
 * Get database statistics
 * @returns Object with patient counts and sync queue length
 */
export async function getStats(): Promise<{
    totalPatients: number;
    unsyncedPatients: number;
    syncQueueLength: number;
}> {
    try {
        const db = await getDB();
        const [allPatients, unsyncedPatients, syncQueue] = await Promise.all([
            db.getAll(DATABASE_CONFIG.STORES.PATIENTS),
            db.getAllFromIndex(DATABASE_CONFIG.STORES.PATIENTS, 'by-sync', false as unknown as IDBValidKey),
            db.getAll(DATABASE_CONFIG.STORES.SYNC_QUEUE),
        ]);

        return {
            totalPatients: allPatients.length,
            unsyncedPatients: unsyncedPatients.length,
            syncQueueLength: syncQueue.length,
        };
    } catch (error) {
        logger.error('Failed to get database stats', { error });
        throw new DatabaseError('Failed to retrieve statistics', error);
    }
}

/**
 * Clear ALL patient records (Development/Reset)
 */
export async function clearAllPatients(): Promise<void> {
    try {
        const db = await getDB();
        await db.clear(DATABASE_CONFIG.STORES.PATIENTS);
        logger.info('Cleared all patient records');
    } catch (error) {
        logger.error('Failed to clear all patients', { error });
        throw new DatabaseError('Failed to clear all records', error);
    }
}
