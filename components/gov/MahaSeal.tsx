/**
 * MahaSeal — Official Seal of the Government of Maharashtra
 * Public Health Department • महाराष्ट्र शासन • सार्वजनिक आरोग्य विभाग
 */

'use client';

import React from 'react';

interface MahaSealProps {
    className?: string;
    size?: number;
}

export default function MahaSeal({ className = '', size = 44 }: MahaSealProps) {
    return (
        <div
            className={`inline-flex items-center select-none ${className}`}
            title="Government of Maharashtra • महाराष्ट्र शासन"
            role="img"
            aria-label="Government of Maharashtra Official Seal"
        >
            <svg
                width={size}
                height={size}
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="flex-shrink-0"
            >
                {/* Outer Ring */}
                <circle cx="50" cy="50" r="47" stroke="#7C2D12" strokeWidth="3" fill="#FFFBEB" />
                <circle cx="50" cy="50" r="43" stroke="#B45309" strokeWidth="1" fill="none" />

                {/* 16 Border Petals (Lotus Rim of Maharashtra Seal) */}
                <g stroke="#B45309" strokeWidth="1" opacity="0.6">
                    <circle cx="50" cy="10" r="2.5" fill="#7C2D12" />
                    <circle cx="65" cy="14" r="2.5" fill="#7C2D12" />
                    <circle cx="78" cy="22" r="2.5" fill="#7C2D12" />
                    <circle cx="86" cy="35" r="2.5" fill="#7C2D12" />
                    <circle cx="90" cy="50" r="2.5" fill="#7C2D12" />
                    <circle cx="86" cy="65" r="2.5" fill="#7C2D12" />
                    <circle cx="78" cy="78" r="2.5" fill="#7C2D12" />
                    <circle cx="65" cy="86" r="2.5" fill="#7C2D12" />
                    <circle cx="50" cy="90" r="2.5" fill="#7C2D12" />
                    <circle cx="35" cy="86" r="2.5" fill="#7C2D12" />
                    <circle cx="22" cy="78" r="2.5" fill="#7C2D12" />
                    <circle cx="14" cy="65" r="2.5" fill="#7C2D12" />
                    <circle cx="10" cy="50" r="2.5" fill="#7C2D12" />
                    <circle cx="14" cy="35" r="2.5" fill="#7C2D12" />
                    <circle cx="22" cy="22" r="2.5" fill="#7C2D12" />
                    <circle cx="35" cy="14" r="2.5" fill="#7C2D12" />
                </g>

                {/* Central Traditional Lamp (Samai / Diya) */}
                {/* Flame */}
                <path
                    d="M50 20 C46 28 44 34 44 40 C44 45 47 48 50 48 C53 48 56 45 56 40 C56 34 54 28 50 20 Z"
                    fill="#EA580C"
                />
                <circle cx="50" cy="40" r="3.5" fill="#FBBF24" />

                {/* Diya Bowl */}
                <path
                    d="M36 48 C36 56 42 60 50 60 C58 60 64 56 64 48 Z"
                    fill="#7C2D12"
                />

                {/* Lamp Pillar Stand */}
                <rect x="47" y="60" width="6" height="15" fill="#7C2D12" />
                <path d="M42 75 L58 75 L62 81 L38 81 Z" fill="#7C2D12" />

                {/* Circular Text: महाराष्ट्र शासन */}
                <text
                    x="50"
                    y="18"
                    textAnchor="middle"
                    fill="#7C2D12"
                    fontSize="5"
                    fontWeight="900"
                    fontFamily="system-ui, sans-serif"
                    letterSpacing="0.6"
                >
                    महाराष्ट्र शासन
                </text>
            </svg>
        </div>
    );
}
