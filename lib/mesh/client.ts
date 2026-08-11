/**
 * Mesh Network Client
 * WebSocket client for participating in mesh network
 * @module lib/mesh/client
 */

import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import { encrypt, decrypt } from '@/lib/crypto/encryption';
import { MESH_CONFIG } from '@/lib/constants/app';
import { retry } from '@/lib/utils/retry';

export interface MeshNode {
    nodeId: string;
    name: string;
    gps: { lat: number; lng: number };
    isOnline: boolean;
    lastSeen: Date;
    signalStrength: number;
}

export interface MeshMessage {
    id: string;
    from: string;
    to?: string;
    payload: unknown;
    timestamp: Date;
    hops: number;
    encrypted: boolean;
}

type MessageHandler = (message: MeshMessage) => void;
type NodesUpdateHandler = (nodes: MeshNode[]) => void;
type ConnectionStatusHandler = (connected: boolean) => void;

export class MeshClient {
    private socket: Socket | null = null;
    private nodeId: string;
    private nodeName: string;
    private gps: { lat: number; lng: number };
    private messageHandlers: Set<MessageHandler> = new Set();
    private nodesUpdateHandlers: Set<NodesUpdateHandler> = new Set();
    private connectionStatusHandlers: Set<ConnectionStatusHandler> = new Set();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;

    constructor(nodeName: string, gps: { lat: number; lng: number }) {
        this.nodeId = uuidv4();
        this.nodeName = nodeName;
        this.gps = gps;
    }

    /**
     * Connect to mesh network
     */
    async connect(): Promise<void> {
        if (this.socket?.connected) {
            logger.warn('Already connected to mesh network');
            return;
        }

        return new Promise((resolve, reject) => {
            try {
                this.socket = io(MESH_CONFIG.SERVER_URL, {
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: this.maxReconnectAttempts,
                    reconnectionDelay: 1000,
                    reconnectionDelayMax: 5000,
                    timeout: MESH_CONFIG.CONNECTION_TIMEOUT_MS,
                });

                this.socket.on('connect', () => {
                    logger.info('Connected to mesh network', { nodeId: this.nodeId });
                    this.reconnectAttempts = 0;
                    this.notifyConnectionStatus(true);
                    this.register();
                    this.startHeartbeat();
                    resolve();
                });

                this.socket.on('disconnect', (reason) => {
                    logger.warn('Disconnected from mesh network', { reason });
                    this.notifyConnectionStatus(false);
                    this.stopHeartbeat();
                });

                this.socket.on('connect_error', (error) => {
                    logger.error('Mesh connection error', { error: error.message });
                    this.reconnectAttempts++;

                    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        reject(new Error('Failed to connect to mesh network'));
                    }
                });

                this.socket.on('mesh:registered', (data: { nodeId: string; peers: MeshNode[] }) => {
                    logger.info('Registered with mesh network', {
                        nodeId: data.nodeId,
                        peers: data.peers.length,
                    });
                });

                this.socket.on('mesh:message', (message: MeshMessage) => {
                    this.handleIncomingMessage(message);
                });

                this.socket.on('mesh:nodes:update', (nodes: MeshNode[]) => {
                    this.notifyNodesUpdate(nodes);
                });

            } catch (error) {
                logger.error('Failed to initialize mesh client', { error });
                reject(error);
            }
        });
    }

    /**
     * Disconnect from mesh network
     */
    disconnect(): void {
        this.stopHeartbeat();

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            logger.info('Disconnected from mesh network');
        }
    }

    /**
     * Register node with mesh server
     */
    private register(): void {
        if (!this.socket) return;

        this.socket.emit('mesh:register', {
            nodeId: this.nodeId,
            name: this.nodeName,
            gps: this.gps,
        });
    }

    /**
     * Start heartbeat to keep connection alive
     */
    private startHeartbeat(): void {
        this.heartbeatInterval = setInterval(() => {
            if (this.socket?.connected) {
                this.socket.emit('mesh:heartbeat', { nodeId: this.nodeId });
            }
        }, MESH_CONFIG.HEARTBEAT_INTERVAL_MS);
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Send message through mesh network
     * @param payload - Data to send
     * @param targetNodeId - Optional target node ID (undefined = broadcast)
     * @param encrypted - Whether to encrypt the payload
     */
    async sendMessage(
        payload: unknown,
        targetNodeId?: string,
        encrypted: boolean = true
    ): Promise<void> {
        if (!this.socket?.connected) {
            throw new Error('Not connected to mesh network');
        }

        const message: MeshMessage = {
            id: uuidv4(),
            from: this.nodeId,
            to: targetNodeId,
            payload: encrypted ? encrypt(payload) : payload,
            timestamp: new Date(),
            hops: 0,
            encrypted,
        };

        logger.info('Sending mesh message', {
            messageId: message.id,
            to: targetNodeId || 'broadcast',
            encrypted,
        });

        this.socket.emit('mesh:relay', message);
    }

    /**
     * Handle incoming message
     */
    private handleIncomingMessage(message: MeshMessage): void {
        try {
            logger.info('Received mesh message', {
                messageId: message.id,
                from: message.from,
                hops: message.hops,
                encrypted: message.encrypted,
            });

            // Decrypt if needed
            if (message.encrypted && typeof message.payload === 'string') {
                message.payload = decrypt(message.payload);
            }

            // Notify handlers
            this.messageHandlers.forEach(handler => {
                try {
                    handler(message);
                } catch (error) {
                    logger.error('Message handler error', { error });
                }
            });
        } catch (error) {
            logger.error('Failed to handle incoming message', { error });
        }
    }

    /**
     * Subscribe to incoming messages
     */
    onMessage(handler: MessageHandler): () => void {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    /**
     * Subscribe to nodes updates
     */
    onNodesUpdate(handler: NodesUpdateHandler): () => void {
        this.nodesUpdateHandlers.add(handler);
        return () => this.nodesUpdateHandlers.delete(handler);
    }

    /**
     * Subscribe to connection status changes
     */
    onConnectionStatus(handler: ConnectionStatusHandler): () => void {
        this.connectionStatusHandlers.add(handler);
        return () => this.connectionStatusHandlers.delete(handler);
    }

    /**
     * Notify all message handlers
     */
    private notifyNodesUpdate(nodes: MeshNode[]): void {
        this.nodesUpdateHandlers.forEach(handler => {
            try {
                handler(nodes);
            } catch (error) {
                logger.error('Nodes update handler error', { error });
            }
        });
    }

    /**
     * Notify connection status handlers
     */
    private notifyConnectionStatus(connected: boolean): void {
        this.connectionStatusHandlers.forEach(handler => {
            try {
                handler(connected);
            } catch (error) {
                logger.error('Connection status handler error', { error });
            }
        });
    }

    /**
     * Get current node info
     */
    getNodeInfo(): { nodeId: string; name: string; gps: { lat: number; lng: number } } {
        return {
            nodeId: this.nodeId,
            name: this.nodeName,
            gps: this.gps,
        };
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.socket?.connected ?? false;
    }
}

// Singleton instance
let meshClientInstance: MeshClient | null = null;

/**
 * Get or create mesh client instance
 */
export function getMeshClient(
    nodeName: string,
    gps: { lat: number; lng: number }
): MeshClient {
    if (!meshClientInstance) {
        meshClientInstance = new MeshClient(nodeName, gps);
    }
    return meshClientInstance;
}

/**
 * Destroy mesh client instance
 */
export function destroyMeshClient(): void {
    if (meshClientInstance) {
        meshClientInstance.disconnect();
        meshClientInstance = null;
    }
}
