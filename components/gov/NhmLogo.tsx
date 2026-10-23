/**
 * NhmLogo — Official National Health Mission (NHM) Emblem
 * Government of India & Department of Public Health, Maharashtra
 * Authentic vector representation of the official NHM seal
 */

'use client';

import React from 'react';

interface NhmLogoProps {
    className?: string;
    size?: number;
    showLabel?: boolean;
}

export default function NhmLogo({ className = '', size = 44, showLabel = false }: NhmLogoProps) {
    return (
        <div
            className={`inline-flex items-center gap-2 select-none ${className}`}
            title="National Health Mission • राष्ट्रीय स्वास्थ्य अभियान"
            role="img"
            aria-label="National Health Mission Logo"
        >
            <svg
                width={size}
                height={size}
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0 overflow-visible"
            >
                {/* Outer Golden / Green Official Seal Ring */}
                <circle cx="50" cy="50" r="47" stroke="#166534" strokeWidth="2.5" fill="#FFFFFF" />
                <circle cx="50" cy="50" r="43" stroke="#D97706" strokeWidth="1.2" fill="none" strokeDasharray="3 2" />

                {/* Left Protecting Green Hand / Leaf Arc */}
                <path
                    d="M22 64 C16 48 24 28 42 20 C46 18 48 22 45 24 C32 30 26 44 30 58 C32 64 26 68 22 64 Z"
                    fill="#16A34A"
                />

                {/* Right Protecting Green Hand / Leaf Arc */}
                <path
                    d="M78 64 C84 48 76 28 58 20 C54 18 52 22 55 24 C68 30 74 44 70 58 C68 64 74 68 78 64 Z"
                    fill="#15803D"
                />

                {/* Central Healthcare Red Cross / Emblem */}
                <g fill="#DC2626">
                    <rect x="44" y="32" width="12" height="34" rx="2" />
                    <rect x="33" y="43" width="34" height="12" rx="2" />
                </g>

                {/* Center Golden Flame / Diya Core */}
                <circle cx="50" cy="49" r="6" fill="#FBBF24" />
                <circle cx="50" cy="49" r="3" fill="#FFFFFF" />

                {/* Base Support Cradle */}
                <path
                    d="M32 72 Q50 82 68 72 Q50 86 32 72 Z"
                    fill="#166534"
                />

                {/* Mini Devanagari NHM Text Arc Base */}
                <text
                    x="50"
                    y="91"
                    textAnchor="middle"
                    fill="#166534"
                    fontSize="6.5"
                    fontWeight="800"
                    fontFamily="system-ui, sans-serif"
                    letterSpacing="0.5"
                >
                    NHM • भारत
                </text>
            </svg>

            {showLabel && (
                <div className="flex flex-col text-left leading-tight">
                    <span className="text-[11px] font-black text-emerald-900 tracking-tight">राष्ट्रीय आरोग्य अभियान</span>
                    <span className="text-[9px] font-bold text-emerald-700 tracking-wider">NATIONAL HEALTH MISSION</span>
                </div>
            )}
        </div>
    );
}
