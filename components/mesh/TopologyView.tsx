/**
 * Mesh Network Topology Visualizer - Modern Medcare
 * Clean D3-style visualization of node connections
 */

'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Node {
    id: string;
    x: number;
    y: number;
    status: 'active' | 'inactive' | 'syncing';
    label: string;
}

interface TopologyViewProps {
    nodes?: Node[];
}

export default function TopologyView({ nodes: propNodes }: TopologyViewProps) {
    // Mock simulation if no props
    const defaultNodes: Node[] = [
        { id: '1', x: 50, y: 50, status: 'active', label: 'Triage 1' },
        { id: '2', x: 200, y: 80, status: 'active', label: 'Command' },
        { id: '3', x: 120, y: 200, status: 'syncing', label: 'Tablet 3' },
        { id: '4', x: 300, y: 150, status: 'inactive', label: 'Field 4' },
    ];

    const nodes = propNodes || defaultNodes;

    return (
        <div className="relative w-full h-[400px] bg-white/50 backdrop-blur-sm rounded-xl border border-border-subtle overflow-hidden">
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Connections */}
                <motion.path
                    d={`M${nodes[0].x},${nodes[0].y} L${nodes[1].x},${nodes[1].y} L${nodes[2].x},${nodes[2].y} L${nodes[0].x},${nodes[0].y}`}
                    stroke="var(--border-active)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                />
            </svg>

            {nodes.map((node) => (
                <motion.div
                    key={node.id}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, delay: Math.random() * 0.5 }}
                    className="absolute group cursor-pointer"
                    style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)' }}
                >
                    {/* Ripple Effect for Active Nodes */}
                    {node.status === 'active' && (
                        <div className="absolute inset-0 -m-4 bg-teal-accent/20 rounded-full animate-ping opacity-75" />
                    )}

                    {/* Node Core */}
                    <div className={`relative w-4 h-4 rounded-full border-2 border-white shadow-md z-10 transition-colors ${node.status === 'active' ? 'bg-teal-accent' :
                        node.status === 'syncing' ? 'bg-status-yellow' :
                            'bg-txt-muted'
                        }`} />

                    {/* Label */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white px-2 py-1 rounded shadow-sm border border-border-subtle text-[10px] font-semibold text-txt-secondary opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        {node.label}
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
