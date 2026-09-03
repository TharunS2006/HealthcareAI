/**
 * ErrorState — Shown when a data fetch or operation fails.
 * Always provides a retry action (GIGW: no dead-end screens).
 */

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
}

export default function ErrorState({
    title = 'Something went wrong',
    message = 'We could not load the requested data. Please try again.',
    onRetry,
}: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center" role="alert">
            <span className="text-5xl mb-4" aria-hidden="true">⚠️</span>
            <h3 className="text-lg font-bold text-gov-red mb-1">{title}</h3>
            <p className="text-sm text-txt-secondary max-w-md mb-4">{message}</p>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="gov-btn gov-btn-primary"
                >
                    Try Again
                </button>
            )}
        </div>
    );
}
