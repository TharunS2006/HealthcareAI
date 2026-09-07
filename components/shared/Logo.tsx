/**
 * Official Identity Logo — Department of Public Health, Government of Maharashtra
 * National Health Mission (NHM) • Ayushman Bharat Digital Mission (ABDM)
 */

'use client';

import React from 'react';
import StateEmblem from '@/components/gov/StateEmblem';
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
    const subText = isDark ? 'text-slate-700' : 'text-slate-200';

    const emblemSizes = {
        sm: 28,
        md: 38,
        lg: 50,
    };

    const s = emblemSizes[size];

    return (
        <div className={`flex items-center gap-3 select-none ${className}`}>
            {/* Authentic National Emblem of India */}
            <StateEmblem size={s} light={!isDark} />

            {showText && (
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`text-lg font-black tracking-tight leading-none ${primaryText}`}>
                            {isEn ? 'NalamMesh' : 'नलममेश'}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-[#1F3A6E] border border-slate-300 font-bold rounded">
                            NHM महाराष्ट्र
                        </span>
                    </div>
                    <span className={`text-[10px] font-bold tracking-wide mt-1 uppercase ${subText}`}>
                        {isEn
                            ? 'Govt. of Maharashtra • Public Health Dept'
                            : isHi
                            ? 'महाराष्ट्र सरकार • लोक स्वास्थ्य विभाग'
                            : 'महाराष्ट्र शासन • सार्वजनिक आरोग्य विभाग'}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium hidden sm:block">
                        {isEn
                            ? 'National Health Mission • ABDM Certified DPI'
                            : isHi
                            ? 'राष्ट्रीय स्वास्थ्य मिशन • ABDM प्रमाणित DPI'
                            : 'राष्ट्रीय आरोग्य अभियान • ABDM प्रमाणित DPI'}
                    </span>
                </div>
            )}
        </div>
    );
}
