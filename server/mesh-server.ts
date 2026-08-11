/**
 * Mesh Network Server - WebSocket-based simulation
 * Handles node registration, discovery, and message routing
 * @module server/mesh-server
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import crypto from 'crypto';

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
    cors: {
        origin: "*",
        methods: ['GET', 'POST'],
    },
    pingTimeout: 10000,
    pingInterval: 5000,
});

interface MeshNode {
    nodeId: string;
    socketId: string;
    name: string;
    gps: { lat: number; lng: number };
    connectedAt: Date;
    lastSeen: Date;
}

interface RelayMessage {
    id: string;
    from: string;
    to?: string; // undefined = broadcast
    payload: unknown;
    timestamp: Date;
    hops: number;
}

const nodes = new Map<string, MeshNode>();
const messageCache = new Map<string, RelayMessage>();
const MAX_HOPS = 5;
const MESSAGE_TTL_MS = 60000; // 1minute

/**
 * Log with timestamp
 */
function log(message: string, data?: object): void {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        message,
        ...data,
    }));
}

/**
 * Clean expired messages from cache
 */
function cleanMessageCache(): void {
    const now = Date.now();
    messageCache.forEach((msg, id) => {
        if (now - msg.timestamp.getTime() > MESSAGE_TTL_MS) {
            messageCache.delete(id);
        }
    });
}

// Clean cache every minute
setInterval(cleanMessageCache, 60000);

io.on('connection', (socket) => {
    log('New connection', { socketId: socket.id });

    /**
     * Node registration
     */
    socket.on('mesh:register', (data: {
        nodeId: string;
        name: string;
        gps: { lat: number; lng: number };
    }) => {
        const node: MeshNode = {
            nodeId: data.nodeId,
            socketId: socket.id,
            name: data.name,
            gps: data.gps,
            connectedAt: new Date(),
            lastSeen: new Date(),
        };

        nodes.set(data.nodeId, node);

        log('Node registered', {
            nodeId: data.nodeId,
            name: data.name,
            totalNodes: nodes.size,
        });

        // Broadcast updated node list to all clients
        io.emit('mesh:nodes:update', Array.from(nodes.values()));

        // Send confirmation
        socket.emit('mesh:registered', {
            nodeId: data.nodeId,
            peers: Array.from(nodes.values()).filter(n => n.nodeId !== data.nodeId),
        });
    });

    /**
     * Heartbeat to keep node alive
     */
    socket.on('mesh:heartbeat', (data: { nodeId: string }) => {
        const node = nodes.get(data.nodeId);
        if (node) {
            node.lastSeen = new Date();
        }
    });

    /**
     * Message relay
     */
    socket.on('mesh:relay', (data: RelayMessage) => {
        // Check if message already processed (prevent loops)
        if (messageCache.has(data.id)) {
            log('Duplicate message ignored', { messageId: data.id });
            return;
        }

        // Check hop limit
        if (data.hops >= MAX_HOPS) {
            log('Message exceeded max hops', {
                messageId: data.id,
                hops: data.hops,
            });
            return;
        }

        // Cache message
        messageCache.set(data.id, data);

        log('Message relayed', {
            messageId: data.id,
            from: data.from,
            to: data.to || 'broadcast',
            hops: data.hops,
        });

        // Increment hop count
        data.hops++;

        // Targeted delivery or broadcast
        if (data.to) {
            const targetNode = nodes.get(data.to);
            if (targetNode) {
                io.to(targetNode.socketId).emit('mesh:message', data);
            }
        } else {
            // Broadcast to all except sender
            const senderNode = nodes.get(data.from);
            if (senderNode) {
                socket.broadcast.emit('mesh:message', data);
            }
        }
    });

    /**
     * Patient Data Sync
     * Broadcasts new/updated patient records to all connected clients
     */
    socket.on('patient:sync', (patient: any) => {
        // Broadcast to everyone else (excluding sender)
        socket.broadcast.emit('patient:sync', patient);
        log('Patient sync broadcasted', { patientId: patient.id });
    });

    /**
     * Global Data Reset Sync
     * Broadcasts a reset command to all connected clients
     */
    socket.on('data:reset', () => {
        // Broadcast to everyone else (excluding sender)
        socket.broadcast.emit('data:reset');
        log('Global reset command broadcasted');
    });

    /**
     * Disconnect handling
     */
    socket.on('disconnect', () => {
        // Find and remove disconnected node
        let disconnectedNodeId: string | undefined;
        nodes.forEach((node, nodeId) => {
            if (node.socketId === socket.id) {
                disconnectedNodeId = nodeId;
                nodes.delete(nodeId);
            }
        });

        if (disconnectedNodeId) {
            log('Node disconnected', {
                nodeId: disconnectedNodeId,
                remainingNodes: nodes.size,
            });

            // Notify all clients
            io.emit('mesh:nodes:update', Array.from(nodes.values()));
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        nodes: nodes.size,
        cachedMessages: messageCache.size,
        uptime: process.uptime(),
    });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    res.json({
        nodes: Array.from(nodes.values()).map(n => ({
            nodeId: n.nodeId,
            name: n.name,
            connectedAt: n.connectedAt,
            lastSeen: n.lastSeen,
        })),
        messageCache: messageCache.size,
    });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
    log(`Mesh network server running on port ${PORT}`);
});
