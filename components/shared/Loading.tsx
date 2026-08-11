/**
 * Loading components for consistent UX
 * Modern Medcare Style - Clean skeletons and teal spinners
 * @module components/shared/Loading
 */

'use client';

import React from 'react';

/**
 * Spinner component for inline loading states
 */
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div className="flex items-center justify-center">
            <div className={`${sizeClasses[size]} border-2 border-teal-accent border-t-transparent rounded-full animate-spin`} />
        </div>
    );
}

/**
 * Full page loading screen
 */
export function LoadingScreen({ message = 'Loading System...' }: { message?: string }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-bg-page">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-emerald-deep font-semibold text-sm animate-pulse">{message}</p>
        </div>
    );
}

/**
 * Skeleton loader for patient cards
 */
export function PatientCardSkeleton() {
    return (
        <div className="bg-white rounded-xl p-6 border border-border-subtle shadow-sm animate-pulse">
            <div className="flex items-start justify-between">
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg" />
                        <div className="flex-1">
                            <div className="h-5 bg-gray-100 rounded w-32 mb-2" />
                            <div className="h-4 bg-gray-50 rounded w-24" />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i}>
                                <div className="h-3 bg-gray-50 rounded w-16 mb-2" />
                                <div className="h-5 bg-gray-100 rounded w-20" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Skeleton loader for dashboard stats
 */
export function StatsCardSkeleton() {
    return (
        <div className="surface-card p-6 animate-pulse bg-white">
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <div className="h-4 bg-gray-100 rounded w-24 mb-3" />
                    <div className="h-8 bg-gray-100 rounded w-16" />
                </div>
                <div className="w-12 h-12 bg-gray-50 rounded-xl" />
            </div>
        </div>
    );
}
