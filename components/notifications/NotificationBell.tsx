/**
 * The bell — unread count and the latest notifications for one user.
 *
 * Takes the session it belongs to as a prop, so the header shows the tab's
 * user and each pane of the two-user simulation shows its own.
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useReferralStore } from '@/stores/referralStore';
import type { StaffSession } from '@/stores/authStore';
import { NOTIFICATION_LABELS, notificationTone } from '@/lib/notifications/labels';
import { alertSoundEnabled, setAlertSoundEnabled } from '@/lib/notifications/sound';
import { timeAgo } from '@/lib/utils/time';

interface Props {
    session: StaffSession;
    /** Open a referral in place (simulation panes); defaults to /referrals?id=. */
    onOpenReferral?: (referralId: string) => void;
    /** Which edge the dropdown aligns to. */
    align?: 'left' | 'right';
    compact?: boolean;
}

export default function NotificationBell({ session, onOpenReferral, align = 'right', compact = false }: Props) {
    const router = useRouter();
    const all = useReferralStore(s => s.notifications);
    const markRead = useReferralStore(s => s.markRead);
    const [open, setOpen] = useState(false);
    const [sound, setSound] = useState(true);
    const [now, setNow] = useState(() => Date.now());
    const panelRef = useRef<HTMLDivElement>(null);

    const mine = useMemo(() => all.filter(n => n.recipient_user_id === session.userId), [all, session.userId]);
    const unread = mine.filter(n => !n.is_read);

    useEffect(() => setSound(alertSoundEnabled()), []);

    useEffect(() => {
        if (!open) return;
        setNow(Date.now());
        const onDown = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const openReferral = (notificationId: string, referralId: string) => {
        void markRead([notificationId]);
        setOpen(false);
        if (onOpenReferral) onOpenReferral(referralId);
        else router.push(`/referrals?id=${encodeURIComponent(referralId)}`);
    };

    return (
        <div className="relative" ref={panelRef}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`relative flex items-center justify-center border border-slate-300 bg-white hover:bg-slate-50 rounded text-[#1F3A6E] ${compact ? 'w-8 h-8' : 'w-9 h-9'}`}
                aria-label={`Notifications — ${unread.length} unread`}
                aria-expanded={open}
                aria-haspopup="true"
            >
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unread.length > 0 && (
                    <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center text-white ${unread.some(n => n.priority === 'EMERGENCY') ? 'bg-red-600' : 'bg-[#1F3A6E]'}`}>
                        {unread.length > 99 ? '99+' : unread.length}
                    </span>
                )}
            </button>

            {open && (
                <div
                    className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 w-[min(22rem,calc(100vw-2rem))] bg-white border border-[#B9C5D6] shadow-xl z-[60]`}
                    role="dialog"
                    aria-label="Notifications"
                >
                    <div className="bg-[#1F3A6E] text-white px-3 py-2 flex items-center justify-between">
                        <strong className="text-[12px]">Notifications · {session.name}</strong>
                        {unread.length > 0 && (
                            <button type="button" onClick={() => void markRead(unread.map(n => n.id))} className="text-[11px] underline text-white/90 hover:text-white">
                                Mark all read
                            </button>
                        )}
                    </div>
                    <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                        {mine.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-600">No notifications yet.</li>}
                        {mine.slice(0, 30).map(n => (
                            <li key={n.id}>
                                <button
                                    type="button"
                                    onClick={() => openReferral(n.id, n.referral_id)}
                                    className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 ${n.is_read ? '' : 'bg-blue-50/40'}`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 border rounded ${notificationTone(n.type)}`}>
                                            {NOTIFICATION_LABELS[n.type]}
                                            {n.priority === 'EMERGENCY' ? ' · EMERGENCY' : ''}
                                        </span>
                                        <span className="text-[10px] text-slate-600 shrink-0">
                                            {!n.is_read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mr-1 align-middle" aria-label="unread" />}
                                            {timeAgo(n.created_at, now)}
                                        </span>
                                    </div>
                                    <p className="text-[12px] text-slate-800 mt-1 leading-snug">{n.message}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <label className="flex items-center gap-2 px-3 py-2 border-t border-slate-200 text-[11px] text-slate-600">
                        <input
                            type="checkbox"
                            checked={sound}
                            onChange={e => {
                                setSound(e.target.checked);
                                setAlertSoundEnabled(e.target.checked);
                            }}
                        />
                        Sound for Emergency alerts
                    </label>
                </div>
            )}
        </div>
    );
}
