import { io, Socket } from 'socket.io-client';
import { blockedAsMixedContent } from '@/lib/cloudEndpoint';
import { useAuthStore } from '@/stores/authStore';

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

/**
 * Websockets, or HTTP polling only. A hosted relay on serverless functions has
 * no websockets (server/relay/vercel.ts), so a build pointed at one sets
 * NEXT_PUBLIC_MESH_TRANSPORT=http and never dials a socket it cannot open.
 */
export const relayUsesSockets = (): boolean => process.env.NEXT_PUBLIC_MESH_TRANSPORT?.trim() !== 'http';

/** HTTP polling reports what it found, so the status chip is true without a socket. */
export const reportRelayReachable = (reachable: boolean): void => setMeshStatus(reachable ? 'ONLINE' : 'STANDALONE');

/** Subscribe to relay status changes. Returns an unsubscribe function. */
export const subscribeMeshStatus = (notify: (status: MeshStatus) => void): (() => void) => {
    statusListeners.add(notify);
    return () => {
        statusListeners.delete(notify);
    };
};

/**
 * The relay's address. Resolving from window.location.hostname works in a browser
 * on the same machine, but NOT in the Android build: Capacitor serves the app from
 * a local origin inside the phone, so the hostname is "localhost" and the device
 * would dial its own loopback. Set NEXT_PUBLIC_MESH_URL to the relay's LAN address
 * (e.g. http://192.168.1.20:3001) when building the APK.
 */
export const relayBaseUrl = (): string => {
    const configured = process.env.NEXT_PUBLIC_MESH_URL?.trim();
    if (configured) return configured.replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        // A Capacitor/localhost origin cannot reach a relay on another machine.
        const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '';
        return isLoopback ? 'http://localhost:3001' : `http://${host}:3001`;
    }
    return 'http://localhost:3001';
};

export const getSocket = (): Socket => {
    if (!socket) {
        const SERVER_URL = relayBaseUrl();
        // A relay the browser will refuse (plain HTTP from an HTTPS page) is never
        // dialled: it could only fail, and would retry with a console error each time.
        // Neither is a relay that has no websockets.
        const reachable = relayUsesSockets() && !blockedAsMixedContent(SERVER_URL);

        socket = io(SERVER_URL, {
            transports: ['polling', 'websocket'],
            autoConnect: reachable,
            // Sent on every (re)connection, so the relay knows who this socket is.
            auth: (cb) => cb({ token: useAuthStore.getState().session?.token ?? null }),
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
        // HTTP-only: the poll in lib/referrals/transport.ts reports reachability.
        if (!reachable && !relayUsesSockets()) setMeshStatus('CONNECTING');
        else if (!reachable) setMeshStatus('STANDALONE');
    }
    return socket;
};
