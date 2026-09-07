/**
 * ErrorState — Shown when a data fetch or operation fails.
 * Always provides a retry action (GIGW: no dead-end screens).
 */

import Icon from './Icon';

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
            <Icon name="warning" className="w-12 h-12 mb-4 text-gov-red" />
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
