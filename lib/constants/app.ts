/**
 * Application-wide constants — NalamMesh Rural Healthcare (SIH PS#26133)
 * @module constants/app
 */

export const APP_CONFIG = {
    NAME: 'NalamMesh — Rural Healthcare Access Platform',
    STATE: 'Maharashtra',
    DISTRICT: 'Gadchiroli',
    VERSION: '2.0.0',
    ENVIRONMENT: process.env.NODE_ENV || 'development',
} as const;

export const TRIAGE_CONFIG = {
    MAX_PROCESSING_TIME_MS: 50,
    THRESHOLDS: {
        SPO2: { CRITICAL: 90, URGENT: 95 },
        HEART_RATE: { CRITICAL_HIGH: 130, CRITICAL_LOW: 48, URGENT_HIGH: 105 },
        BLOOD_PRESSURE: { SYSTOLIC_CRITICAL: 160, DIASTOLIC_CRITICAL: 100 },
        BLOOD_GLUCOSE: { CRITICAL_HIGH: 280, CRITICAL_LOW: 55 },
        RESPIRATORY_RATE: { CRITICAL_HIGH: 36, CRITICAL_LOW: 10 },
    } as const,
} as const;

export const DATABASE_CONFIG = {
    NAME: 'nalammesh-rural-db',
    VERSION: 2,
    STORES: {
        PATIENTS: 'patients',
        REFERRALS: 'referrals',
        QUEUE: 'queue',
        FACILITIES: 'facilities',
        MEDICINE_STOCK: 'medicineStock',
        DIAGNOSTICS: 'diagnostics',
        SYNC_QUEUE: 'syncQueue',
    } as const,
} as const;

export const SYNC_CONFIG = {
    SYNC_INTERVAL_MS: 30000,
    MAX_RETRY_ATTEMPTS: 5,
    INITIAL_BACKOFF_MS: 1000,
    MAX_BACKOFF_MS: 60000,
} as const;

export const MESH_CONFIG = {
    SERVER_URL: process.env.NEXT_PUBLIC_MESH_SERVER_URL || 'ws://localhost:3001',
    HEARTBEAT_INTERVAL_MS: 5000,
    CONNECTION_TIMEOUT_MS: 10000,
    MAX_NODES: 100,
} as const;

export const SMS_CONFIG = {
    ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    FALLBACK_DELAY_MS: 30000,
} as const;

export const ERROR_MESSAGES = {
    DATABASE: {
        SAVE_FAILED: 'Failed to save patient record. Please try again.',
        LOAD_FAILED: 'Failed to load patient records.',
        DELETE_FAILED: 'Failed to delete patient record.',
    },
    TRIAGE: {
        CLASSIFICATION_FAILED: 'Failed to classify triage status.',
        INVALID_VITALS: 'Invalid vital signs provided.',
    },
    NETWORK: {
        OFFLINE: 'You are currently offline. Data will sync via mesh network.',
        SYNC_FAILED: 'Failed to sync data. Retrying in background.',
    },
} as const;

export const ROUTES = {
    HOME: '/',
    OPD: '/opd',
    DASHBOARD: '/dashboard',
    REFERRALS: '/referrals',
    QUEUE: '/queue',
    TELECONSULT: '/teleconsult',
    MEDICINE: '/medicine',
    MESH_DEMO: '/mesh-demo',
    TRIAGE: '/opd',
} as const;

export const LOCAL_STORAGE_KEYS = {
    THEME: 'nalammesh:theme',
    USER_PREFERENCES: 'nalammesh:preferences',
    LAST_SYNC: 'nalammesh:last_sync',
} as const;
