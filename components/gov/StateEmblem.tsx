/**
 * StateEmblem — Authentic State Emblem of India (Lion Capital of Ashoka)
 * Government of India & Government of Maharashtra Official Emblem
 * Official authentic vector representation
 */

'use client';

import React from 'react';

interface StateEmblemProps {
    className?: string;
    size?: number;
    light?: boolean;
}

export default function StateEmblem({ className = '', size = 44, light = false }: StateEmblemProps) {
    const width = size;
    const height = Math.round(size * 1.58);

    return (
        <div
            className={`inline-flex flex-col items-center justify-center select-none flex-shrink-0 ${className}`}
            title="State Emblem of India • भारत का राज्यचिन्ह • सत्यमेव जयते"
            role="img"
            aria-label="State Emblem of India"
        >
            <img
                src="/emblem.svg"
                alt="State Emblem of India • सत्यमेव जयते"
                width={width}
                height={height}
                className={`object-contain flex-shrink-0 ${light ? 'brightness-0 invert opacity-95' : ''}`}
                style={{ width: `${width}px`, height: `${height}px` }}
            />
        </div>
    );
}
