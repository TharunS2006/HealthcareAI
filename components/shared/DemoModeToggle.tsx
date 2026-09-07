/**
 * Demo Mode Toggle Button — Government Admin Interface
 * Allows evaluators and clinical superintendents to activate automated patient flow
 * Trilingual Localization: English, Marathi, Hindi
 */

'use client';

import { useState, useEffect } from 'react';
import { startDemoMode, stopDemoMode, isDemoRunning } from '@/lib/demoMode';
import { useLanguageStore } from '@/stores/languageStore';

export default function DemoModeToggle() {
    const [running, setRunning] = useState(false);
    const { language } = useLanguageStore();

    const isEn = language === 'en';
    const isHi = language === 'hi';

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

    const label = running
        ? (isEn ? 'Stop Demo' : isHi ? 'डेमो रोकें' : 'डेमो थांबवा')
        : (isEn ? 'Start Demo Flow' : isHi ? 'डेमो प्रवाह शुरू करें' : 'डेमो प्रवाह सुरू करा');

    return (
        <button
            onClick={toggle}
            className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                running
                    ? 'bg-red-700 text-white border-red-800'
                    : 'bg-[#1F3A6E] hover:bg-[#16294E] text-white border-[#11223F]'
            }`}
            title={isEn ? 'Auto-generates simulated patient flow for demo purposes' : isHi ? 'मूल्यांकन व प्रस्तुतीकरण हेतु स्वचालित मरीज प्रवाह' : 'मूल्यमापन व सादरीकरणासाठी स्वयंचलित रुग्ण प्रवाह सुरू करा'}
        >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {running ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
            </svg>
            <span>{label}</span>
        </button>
    );
}
