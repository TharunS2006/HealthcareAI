/**
 * Demo Mode Toggle Button
 * Allows judges and presenters to activate automated live patient streaming
 */

'use client';

import { useState, useEffect } from 'react';
import { startDemoMode, stopDemoMode, isDemoRunning } from '@/lib/demoMode';

export default function DemoModeToggle() {
    const [running, setRunning] = useState(false);

    useEffect(() => {
        setRunning(isDemoRunning());
    }, []);

    const toggle = () => {
        if (running) {
            stopDemoMode();
            setRunning(false);
        } else {
            startDemoMode();
            setRunning(true);
        }
    };

    return (
        <button
            onClick={toggle}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 border ${
                running
                    ? 'bg-red-500 text-white border-red-600 shadow-red-500/20'
                    : 'bg-emerald-deep text-white border-emerald-dark hover:scale-[1.02]'
            }`}
            title="Auto-generates simulated patient flow for demo purposes"
        >
            {running ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
            ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )}
            <span>{running ? 'Stop Demo' : 'Start Demo Flow'}</span>
        </button>
    );
}
