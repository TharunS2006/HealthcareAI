/**
 * AccessibilityToolbar — GIGW-required font-size toggle + contrast toggle
 * Persists preferences to localStorage.
 */

'use client';

import { useState, useEffect } from 'react';

export default function AccessibilityToolbar() {
    const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
    const [contrast, setContrast] = useState<'normal' | 'high'>('normal');

    useEffect(() => {
        const savedSize = localStorage.getItem('gs-font-size') as 'normal' | 'large' | null;
        const savedContrast = localStorage.getItem('gs-contrast') as 'normal' | 'high' | null;
        if (savedSize) {
            setFontSize(savedSize);
            applyFontSize(savedSize);
        }
        if (savedContrast) {
            setContrast(savedContrast);
            applyContrast(savedContrast);
        }
    }, []);

    const applyFontSize = (size: 'normal' | 'large') => {
        document.documentElement.style.setProperty(
            '--font-scale',
            size === 'large' ? '1.15' : '1'
        );
    };

    const applyContrast = (mode: 'normal' | 'high') => {
        if (mode === 'high') {
            document.documentElement.setAttribute('data-contrast', 'high');
        } else {
            document.documentElement.removeAttribute('data-contrast');
        }
    };

    const toggleFontSize = () => {
        const next = fontSize === 'normal' ? 'large' : 'normal';
        setFontSize(next);
        applyFontSize(next);
        localStorage.setItem('gs-font-size', next);
    };

    const toggleContrast = () => {
        const next = contrast === 'normal' ? 'high' : 'normal';
        setContrast(next);
        applyContrast(next);
        localStorage.setItem('gs-contrast', next);
    };

    return (
        <div className="flex items-center gap-1" role="toolbar" aria-label="Accessibility options">
            <button
                onClick={toggleFontSize}
                className={`px-2 py-1 rounded text-xs font-bold transition-colors border ${
                    fontSize === 'large'
                        ? 'bg-gov-navy text-white border-gov-navy'
                        : 'bg-white text-txt-secondary border-border-subtle hover:bg-bg-surface-hover'
                }`}
                aria-label={fontSize === 'normal' ? 'Increase font size' : 'Reset font size'}
                title={fontSize === 'normal' ? 'Larger text (A+)' : 'Normal text (A)'}
            >
                {fontSize === 'normal' ? 'A+' : 'A'}
            </button>

            <button
                onClick={toggleContrast}
                className={`px-2 py-1 rounded text-xs font-bold transition-colors border ${
                    contrast === 'high'
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-txt-secondary border-border-subtle hover:bg-bg-surface-hover'
                }`}
                aria-label={contrast === 'normal' ? 'Enable high contrast' : 'Disable high contrast'}
                title={contrast === 'normal' ? 'High contrast mode' : 'Normal contrast'}
            >
                ◐
            </button>
        </div>
    );
}
