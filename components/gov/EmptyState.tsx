/**
 * EmptyState — Shown when a list has no items or data is absent.
 * GIGW: Never show a blank screen; always provide guidance.
 */

import Icon, { IconName } from './Icon';

interface EmptyStateProps {
    icon?: IconName;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}

export default function EmptyState({ icon = 'clipboard', title, description, actionLabel, onAction }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center" role="status">
            <Icon name={icon} className="w-12 h-12 mb-4 text-slate-300" />
            <h3 className="text-lg font-bold text-txt-primary mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-txt-secondary max-w-md mb-4">{description}</p>
            )}
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="gov-btn gov-btn-primary"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
