import { io, Socket } from 'socket.io-client';

/**
 * Live relay status, published separately from the Socket so the UI can show real
 * connectivity without pulling socket.io-client into its own bundle.
 *
 * The sidebar badge used to be hardcoded to ONLINE and stayed green even with no relay
 * reachable at all. That is the one thing a triage workstation must not misreport: a
 * health worker who believes a RED referral has reached the district will not fall back
 * to the SMS or paper handoff, and the referral is then simply lost.
 *
 * STANDALONE is a normal operating mode here, not an error — the app is built to work
 * with no relay. It just has to say so.
 */
export type MeshStatus = 'CONNECTING' | 'ONLINE' | 'STANDALONE';

// Singleton socket instance
let socket: Socket | null = null;

let meshStatus: MeshStatus = 'CONNECTING';
const statusListeners = new Set<(status: MeshStatus) => void>();

const setMeshStatus = (next: MeshStatus): void => {
    if (next === meshStatus) return;
    meshStatus = next;
    statusListeners.forEach((notify) => notify(meshStatus));
};

export const getMeshStatus = (): MeshStatus => meshStatus;

/** Subscribe to relay status changes. Returns an unsubscribe function. */
export const subscribeMeshStatus = (notify: (status: MeshStatus) => void): (() => void) => {
    statusListeners.add(notify);
    return () => {
        statusListeners.delete(notify);
    };
};

export const getSocket = (): Socket => {
    if (!socket) {
        const SERVER_URL = typeof window !== 'undefined'
            ? `http://${window.location.hostname}:3001`
            : 'http://localhost:3001';

        socket = io(SERVER_URL, {
            transports: ['polling', 'websocket'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
            timeout: 5000,
        });

        socket.on('connect', () => {
            setMeshStatus('ONLINE');
            console.log('Connected to Mesh Server:', socket?.id);
        });

        socket.on('connect_error', (err) => {
            setMeshStatus('STANDALONE');
            console.warn('Mesh Server connection unavailable (Operating in Standalone Mode):', err.message);
        });

        socket.on('disconnect', () => {
            setMeshStatus('STANDALONE');
            console.log('Disconnected from Mesh Server');
        });
    }
    return socket;
};
