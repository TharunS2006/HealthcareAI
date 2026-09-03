/**
 * LoadingSkeleton — Shimmer placeholders instead of spinners.
 * GIGW: Never show an infinite spinner; use content-shaped placeholders.
 */

interface LoadingSkeletonProps {
    /** Number of skeleton rows */
    rows?: number;
    /** Layout style */
    variant?: 'card' | 'list' | 'table' | 'text';
}

function SkeletonBar({ className = '' }: { className?: string }) {
    return (
        <div
            className={`bg-gray-200 rounded animate-pulse ${className}`}
            aria-hidden="true"
        />
    );
}

export default function LoadingSkeleton({ rows = 3, variant = 'card' }: LoadingSkeletonProps) {
    if (variant === 'text') {
        return (
            <div className="space-y-3 p-4" role="status" aria-label="Loading content">
                <SkeletonBar className="h-4 w-3/4" />
                <SkeletonBar className="h-4 w-full" />
                <SkeletonBar className="h-4 w-5/6" />
                <span className="sr-only">Loading…</span>
            </div>
        );
    }

    if (variant === 'table') {
        return (
            <div className="space-y-2 p-4" role="status" aria-label="Loading table">
                <SkeletonBar className="h-10 w-full" />
                {Array.from({ length: rows }).map((_, i) => (
                    <SkeletonBar key={i} className="h-12 w-full" />
                ))}
                <span className="sr-only">Loading…</span>
            </div>
        );
    }

    if (variant === 'list') {
        return (
            <div className="space-y-3 p-4" role="status" aria-label="Loading list">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <SkeletonBar className="h-10 w-10 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <SkeletonBar className="h-4 w-1/3" />
                            <SkeletonBar className="h-3 w-2/3" />
                        </div>
                    </div>
                ))}
                <span className="sr-only">Loading…</span>
            </div>
        );
    }

    // Default: card grid
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4" role="status" aria-label="Loading cards">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="surface-card p-5 space-y-3">
                    <SkeletonBar className="h-5 w-2/3" />
                    <SkeletonBar className="h-3 w-full" />
                    <SkeletonBar className="h-3 w-5/6" />
                    <SkeletonBar className="h-8 w-1/3" />
                </div>
            ))}
            <span className="sr-only">Loading…</span>
        </div>
    );
}
