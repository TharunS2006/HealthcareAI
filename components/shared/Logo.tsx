'use client';

import React from 'react';

interface LogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    variant?: 'dark' | 'light';
    className?: string;
}

export default function Logo({ size = 'md', showText = true, variant = 'dark', className = '' }: LogoProps) {
    const dimensions = {
        sm: { icon: 40, text: 'text-lg', tagline: 'text-[9px]' },
        md: { icon: 56, text: 'text-2xl', tagline: 'text-[10px]' },
        lg: { icon: 140, text: 'text-6xl', tagline: 'text-lg' }
    };

    const colors = {
        dark: {
            text: 'text-slate-900',
            tagline: 'text-slate-600',
            primary: '#1E40AF',
            secondary: '#0D9488'
        },
        light: {
            text: 'text-white',
            tagline: 'text-teal-50/70',
            primary: '#60A5FA',
            secondary: '#2DD4BF'
        }
    };

    const config = colors[variant];

    return (
        <div className={`flex items-center gap-4 ${className} ${size === 'lg' ? 'flex-col text-center' : 'flex-row'}`}>
            <svg
                width={dimensions[size].icon}
                height={dimensions[size].icon}
                viewBox="0 0 140 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="drop-shadow-md overflow-visible"
            >
                <defs>
                    <linearGradient id="logo-gradient" x1="0" y1="0" x2="140" y2="120">
                        <stop offset="0%" stopColor="#2563EB" />
                        <stop offset="60%" stopColor="#0D9488" />
                        <stop offset="100%" stopColor="#14B8A6" />
                    </linearGradient>
                </defs>

                {/* Mesh Waves (Left side) */}
                <path
                    d="M15 50C15 30 35 15 55 15"
                    stroke="url(#logo-gradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    className="opacity-40"
                />
                <path
                    d="M25 65C25 50 40 38 55 38"
                    stroke="url(#logo-gradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    className="opacity-80"
                />

                {/* Stylized N Shape */}
                <path
                    d="M55 35V95 M55 35C80 35 100 60 100 95V35"
                    stroke="url(#logo-gradient)"
                    strokeWidth="18"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Medical Cross (Top Right) */}
                <g transform="translate(100, 5)">
                    <path
                        d="M0 15H28"
                        stroke={variant === 'dark' ? '#0F766E' : '#5EEAD4'}
                        strokeWidth="10"
                        strokeLinecap="round"
                    />
                    <path
                        d="M14 1V29"
                        stroke={variant === 'dark' ? '#0F766E' : '#5EEAD4'}
                        strokeWidth="10"
                        strokeLinecap="round"
                    />
                </g>
            </svg>

            {showText && (
                <div className="flex flex-col whitespace-nowrap">
                    <h1 className={`${dimensions[size].text} font-black tracking-tighter leading-[0.85] ${config.text} drop-shadow-sm`}>
                        NalamMesh
                    </h1>
                    <p className={`${dimensions[size].tagline} font-bold tracking-[0.1em] uppercase mt-1.5 ${config.tagline}`}>
                        Resilient Healthcare Network
                    </p>
                </div>
            )}
        </div>
    );
}
