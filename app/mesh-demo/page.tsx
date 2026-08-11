/**
 * Mesh Network Demo Page - Modern Medcare
 * Network visualization and chat interface
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar from '@/components/shared/Sidebar';
import TopologyView from '@/components/mesh/TopologyView';

export default function MeshDemoPage() {
    const [messages, setMessages] = useState([
        { id: 1, text: 'System check complete. All nodes online.', sender: 'System', time: '10:00 AM' },
        { id: 2, text: 'Requesting updated triage protocols for Sector 4.', sender: 'Triage-1', time: '10:02 AM' },
    ]);
    const [input, setInput] = useState('');

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        setMessages([...messages, { id: Date.now(), text: input, sender: 'Command', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
        setInput('');
    };

    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />

            <main className="flex-1 md:ml-64 p-8 h-screen flex flex-col">
                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-emerald-deep tracking-tight">Mesh Network Status</h1>
                    <p className="text-txt-secondary text-sm">Real-time local connection topology</p>
                </header>

                <div className="grid lg:grid-cols-3 gap-6 flex-1 overflow-hidden">
                    {/* Topology Visualizer */}
                    <div className="lg:col-span-2 surface-card p-6 bg-white shadow-card flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-emerald-deep">Network Topology</h2>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-status-green animate-pulse" />
                                <span className="text-xs font-medium text-status-green">Stable Connection</span>
                            </div>
                        </div>
                        <div className="flex-1 bg-bg-page rounded-xl border border-border-subtle relative overflow-hidden flex items-center justify-center p-4">
                            <TopologyView />
                        </div>
                    </div>

                    {/* Chat / Log */}
                    <div className="surface-card bg-white shadow-card flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-border-subtle bg-gray-50/50">
                            <h2 className="text-sm font-bold text-emerald-deep uppercase tracking-wide">Secure Broadcast</h2>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex flex-col ${msg.sender === 'Command' ? 'items-end' : 'items-start'}`}
                                >
                                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${msg.sender === 'Command'
                                        ? 'bg-teal-accent text-white rounded-br-none'
                                        : 'bg-gray-100 text-txt-primary rounded-bl-none'
                                        }`}>
                                        {msg.text}
                                    </div>
                                    <span className="text-[10px] text-txt-muted mt-1 px-1">
                                        {msg.sender} • {msg.time}
                                    </span>
                                </motion.div>
                            ))}
                        </div>

                        <div className="p-4 border-t border-border-subtle bg-white">
                            <form onSubmit={handleSend} className="flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Type broadcast message..."
                                    className="flex-1 px-4 py-2 bg-gray-50 border border-border-active rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-accent/20 focus:border-teal-accent transition-all"
                                />
                                <button
                                    type="submit"
                                    className="p-2 bg-emerald-deep text-white rounded-xl hover:bg-emerald-800 transition-colors"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
