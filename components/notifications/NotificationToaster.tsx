/**
 * Pops a toast when a notification arrives for this user, and sounds the
 * alert tone for Emergencies (if the user has not turned it off).
 *
 * Only notifications that arrive while the user is watching are toasted —
 * the backlog present at sign-in is what the bell's count is for. 'global'
 * uses the app's toaster; 'inline' draws toasts inside the element it sits
 * in, which is how each pane of the two-user simulation gets its own.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useReferralStore } from '@/stores/referralStore';
import type { StaffSession } from '@/stores/authStore';
import type { NotificationRecord } from '@/types/referral';
import { NOTIFICATION_LABELS, notificationTone } from '@/lib/notifications/labels';
import { isAudibleAlert, playEmergencyAlert } from '@/lib/notifications/sound';

interface Props {
    session: StaffSession | null;
    mode?: 'global' | 'inline';
    onOpenReferral?: (referralId: string) => void;
}

export default function NotificationToaster({ session, mode = 'global', onOpenReferral }: Props) {
    const notifications = useReferralStore(s => s.notifications);
    const loaded = useReferralStore(s => s.loaded);
    const seen = useRef<Set<string> | null>(null);
    const owner = useRef<string | null>(null);
    const [inline, setInline] = useState<NotificationRecord[]>([]);

    useEffect(() => {
        if (!session || !loaded) {
            seen.current = null;
            owner.current = null;
            return;
        }
        const mine = notifications.filter(n => n.recipient_user_id === session.userId && !n.is_read);
        if (seen.current === null || owner.current !== session.userId) {
            // First look for this user: everything already here is backlog.
            seen.current = new Set(mine.map(n => n.id));
            owner.current = session.userId;
            return;
        }
        const fresh = mine.filter(n => !seen.current!.has(n.id));
        if (fresh.length === 0) return;
        fresh.forEach(n => seen.current!.add(n.id));

        if (fresh.some(isAudibleAlert)) playEmergencyAlert();

        if (mode === 'inline') {
            setInline(prev => [...fresh, ...prev].slice(0, 3));
            const ids = new Set(fresh.map(n => n.id));
            setTimeout(() => setInline(prev => prev.filter(n => !ids.has(n.id))), 6500);
            return;
        }
        for (const n of fresh.slice(0, 3)) {
            const urgent = n.priority === 'EMERGENCY';
            const show = urgent ? toast.error : toast.success;
            show(`${NOTIFICATION_LABELS[n.type]}: ${n.message}`, { duration: urgent ? 9000 : 5000, id: n.id });
        }
        if (fresh.length > 3) toast(`${fresh.length - 3} more notifications — see the bell`);
    }, [notifications, loaded, session, mode]);

    if (mode !== 'inline' || inline.length === 0) return null;

    return (
        <div className="absolute top-2 right-2 z-30 w-[min(20rem,calc(100%-1rem))] space-y-1.5" aria-live="polite">
            {inline.map(n => (
                <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                        setInline(prev => prev.filter(x => x.id !== n.id));
                        onOpenReferral?.(n.referral_id);
                    }}
                    className={`w-full text-left border shadow-lg px-3 py-2 bg-white ${n.priority === 'EMERGENCY' ? 'border-red-400' : 'border-[#B9C5D6]'}`}
                >
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 border rounded ${notificationTone(n.type)}`}>
                        {NOTIFICATION_LABELS[n.type]}
                        {n.priority === 'EMERGENCY' ? ' · EMERGENCY' : ''}
                    </span>
                    <p className="text-[12px] text-slate-800 mt-1 leading-snug">{n.message}</p>
                </button>
            ))}
        </div>
    );
}
