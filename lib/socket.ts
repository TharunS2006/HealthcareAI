import { io, Socket } from 'socket.io-client';

// Singleton socket instance
let socket: Socket | null = null;

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
            console.log('Connected to Mesh Server:', socket?.id);
        });

        socket.on('connect_error', (err) => {
            console.warn('Mesh Server connection unavailable (Operating in Standalone Mode):', err.message);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from Mesh Server');
        });
    }
    return socket;
};
