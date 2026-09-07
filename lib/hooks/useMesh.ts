/**
 * Custom hook for mesh network integration
 * @module lib/hooks/useMesh
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { getMeshClient, MeshNode, MeshMessage } from '@/lib/mesh/client';
import { logger } from '@/lib/logger';
import toast from 'react-hot-toast';

interface UseMeshOptions {
    nodeName: string;
    gps: { lat: number; lng: number };
    autoConnect?: boolean;
}

interface UseMeshReturn {
    connected: boolean;
    nodes: MeshNode[];
    currentNodeId: string | null;
    connect: () => Promise<void>;
    disconnect: () => void;
    sendMessage: (payload: unknown, targetNodeId?: string) => Promise<void>;
    onMessage: (handler: (message: MeshMessage) => void) => () => void;
}

export function useMesh({ nodeName, gps, autoConnect = false }: UseMeshOptions): UseMeshReturn {
    const [connected, setConnected] = useState(false);
    const [nodes, setNodes] = useState<MeshNode[]>([]);
    const [client] = useState(() => getMeshClient(nodeName, gps));

    const connect = useCallback(async () => {
        if (connected) return;

        try {
            await client.connect();
            setConnected(true);
            toast.success('Connected to mesh network');
            logger.info('Mesh network connected');
        } catch (error) {
            logger.error('Failed to connect to mesh network', { error });
            toast.error('Failed to connect to mesh network');
            throw error;
        }
    }, [client, connected]);

    const disconnect = useCallback(() => {
        client.disconnect();
        setConnected(false);
        setNodes([]);
        toast('Disconnected from mesh network');
        logger.info('Mesh network disconnected');
    }, [client]);

    const sendMessage = useCallback(async (payload: unknown, targetNodeId?: string) => {
        try {
            await client.sendMessage(payload, targetNodeId);
            toast.success('✓ Message relayed through mesh');
        } catch (error) {
            logger.error('Failed to send mesh message', { error });
            toast.error('Failed to send message');
            throw error;
        }
    }, [client]);

    const onMessage = useCallback((handler: (message: MeshMessage) => void) => {
        return client.onMessage(handler);
    }, [client]);

    // Subscribe to connection status changes
    useEffect(() => {
        const unsubscribe = client.onConnectionStatus((status) => {
            setConnected(status);
        });

        return unsubscribe;
    }, [client]);

    // Subscribe to nodes updates
    useEffect(() => {
        const unsubscribe = client.onNodesUpdate((updatedNodes) => {
            setNodes(updatedNodes);
            logger.debug('Mesh nodes updated', { count: updatedNodes.length });
        });

        return unsubscribe;
    }, [client]);

    // Auto-connect if specified
    useEffect(() => {
        if (autoConnect && !connected) {
            connect().catch(console.error);
        }
    }, [autoConnect, connect, connected]);

    return {
        connected,
        nodes,
        currentNodeId: client.getNodeInfo().nodeId,
        connect,
        disconnect,
        sendMessage,
        onMessage,
    };
}
