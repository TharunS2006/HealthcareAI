/**
 * Application-wide constants
 * @module constants/app
 */

export const APP_CONFIG = {
    NAME: 'NalamMesh DPI',
    VERSION: '1.0.0',
    ENVIRONMENT: process.env.NODE_ENV || 'development',
} as const;

export const TRIAGE_CONFIG = {
    /** Maximum processing time target in milliseconds */
    MAX_PROCESSING_TIME_MS: 50,

    /** Triage classification thresholds */
    THRESHOLDS: {
        SPO2: {
            CRITICAL: 90,
            URGENT: 95,
        },
        HEART_RATE: {
            CRITICAL_HIGH: 120,
            CRITICAL_LOW: 50,
            URGENT_HIGH: 100,
        },
        RESPIRATORY_RATE: {
            CRITICAL_HIGH: 30,
            CRITICAL_LOW: 10,
        },
    } as const,
} as const;

export const DATABASE_CONFIG = {
    NAME: 'nalammesh-db',
    VERSION: 1,
    STORES: {
        PATIENTS: 'patients',
        SYNC_QUEUE: 'syncQueue',
    } as const,
} as const;

export const SYNC_CONFIG = {
    /** How often to attempt sync when online (ms) */
    SYNC_INTERVAL_MS: 30000,

    /** Maximum retry attempts for failed syncs */
    MAX_RETRY_ATTEMPTS: 5,

    /** Initial backoff delay (ms) */
    INITIAL_BACKOFF_MS: 1000,

    /** Maximum backoff delay (ms) */
    MAX_BACKOFF_MS: 60000,
} as const;

export const MESH_CONFIG = {
    /** WebSocket server URL */
    SERVER_URL: process.env.NEXT_PUBLIC_MESH_SERVER_URL || 'ws://localhost:3001',

    /** Heartbeat interval (ms) */
    HEARTBEAT_INTERVAL_MS: 5000,

    /** Connection timeout (ms) */
    CONNECTION_TIMEOUT_MS: 10000,

    /** Maximum nodes in mesh network */
    MAX_NODES: 100,
} as const;

export const SMS_CONFIG = {
    /** Twilio account SID */
    ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,

    /** Twilio auth token */
    AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,

    /** SMS fallback trigger delay (ms) */
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
        OFFLINE: 'You are currently offline. Data will sync when connection is restored.',
        SYNC_FAILED: 'Failed to sync data. Retrying in background.',
    },
} as const;

export const ROUTES = {
    HOME: '/',
    TRIAGE: '/triage',
    DASHBOARD: '/dashboard',
} as const;

export const LOCAL_STORAGE_KEYS = {
    THEME: 'nalammesh:theme',
    USER_PREFERENCES: 'nalammesh:preferences',
    LAST_SYNC: 'nalammesh:last_sync',
} as const;
