/**
 * Official Seal / Logo — Department of Public Health, Government of Maharashtra
 * National Health Mission (NHM) • Ayushman Bharat Digital Mission
 * Trilingual Localization: English, Marathi, Hindi
 */

'use client';

import React from 'react';
import { useLanguageStore } from '@/stores/languageStore';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    variant?: 'dark' | 'light';
    className?: string;
}

export default function Logo({ size = 'md', showText = true, variant = 'dark', className = '' }: LogoProps) {
    const { language } = useLanguageStore();
    const isEn = language === 'en';
    const isHi = language === 'hi';

    const isDark = variant === 'dark';
    const primaryText = isDark ? 'text-[#1F3A6E]' : 'text-white';
    const subText = isDark ? 'text-slate-600' : 'text-slate-200';
    const sealFill = isDark ? '#1F3A6E' : '#FFFFFF';
    const sealInner = isDark ? '#FFFFFF' : '#1F3A6E';
    const goldColor = isDark ? '#B45309' : '#FDE047';

    const iconSizes = {
        sm: 32,
        md: 44,
        lg: 64,
    };

    const s = iconSizes[size];

    return (
        <div className={`flex items-center gap-3 select-none ${className}`}>
            {/* Official Government Health Cadre Seal */}
            <svg
                width={s}
                height={s}
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0"
                aria-label="Government of Maharashtra Health Seal"
            >
                {/* Outer Circular Border (Official Seal Ring) */}
                <circle cx="50" cy="50" r="47" stroke={sealFill} strokeWidth="3" fill="none" />
                <circle cx="50" cy="50" r="43" stroke={goldColor} strokeWidth="1.5" fill="none" />

                {/* Inner Shield / Cross */}
                <circle cx="50" cy="50" r="39" fill={isDark ? '#F8FAFC' : '#1F3A6E'} />

                {/* Red Crescent / Medical Emblem Cross */}
                <path
                    d="M44 26H56V44H74V56H56V74H44V56H26V44H44V26Z"
                    fill="#C53030"
                />

                {/* Central Dharma Chakra Spokes in Gold */}
                <circle cx="50" cy="50" r="8" fill={sealInner} stroke={goldColor} strokeWidth="2" />
                <circle cx="50" cy="50" r="3" fill={goldColor} />
            </svg>

            {showText && (
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className={`text-base font-black tracking-tight leading-none ${primaryText}`}>
                            {isEn ? 'NalamMesh' : 'नलममेश'}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded">
                            NHM
                        </span>
                    </div>
                    <span className={`text-[10px] font-bold tracking-wide mt-1 uppercase ${subText}`}>
                        {isEn
                            ? 'Govt. of Maharashtra • Public Health Dept'
                            : isHi
                            ? 'महाराष्ट्र सरकार • सार्वजनिक स्वास्थ्य विभाग'
                            : 'महाराष्ट्र शासन • सार्वजनिक आरोग्य विभाग'}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium hidden sm:block">
                        {isEn ? 'National Health Mission • ABDM Integrated' : 'राष्ट्रीय आरोग्य अभियान • ABDM प्रमाणित'}
                    </span>
                </div>
            )}
        </div>
    );
}
