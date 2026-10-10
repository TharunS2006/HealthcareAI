/**
 * Referrals — the communication channel between facilities.
 *
 * A Sub Centre raises and follows its referrals here; a PHC or hospital
 * receives, answers and admits them; the District Health Officer watches the
 * district. Every row, action and message is scoped by lib/auth/permissions.ts
 * and moved by lib/referrals/workflow.ts — this page only arranges them.
 */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/shared/Sidebar';
import MobileMenu from '@/components/shared/MobileMenu';
import ReferralBoard from '@/components/referrals/ReferralBoard';
import ReferralDetail from '@/components/referrals/ReferralDetail';
import NewReferralForm from '@/components/referrals/NewReferralForm';
import { useSession } from '@/lib/auth/session';
import { can, ROLE_LABELS } from '@/lib/auth/permissions';
import { REFERRAL_TIMING } from '@/lib/referrals/config';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';

function ReferralsWorkspace() {
    const session = useSession();
    const router = useRouter();
    const params = useSearchParams();
    const [openId, setOpenId] = useState<string | null>(params?.get('id') ?? null);
    const [creating, setCreating] = useState(params?.get('new') === '1');
    const wide = useMediaQuery('(min-width: 1280px)');

    // The bell links here with ?id=; follow it when it changes.
    useEffect(() => {
        const id = params?.get('id');
        if (id) {
            setOpenId(id);
            setCreating(false);
        }
    }, [params]);

    if (!session) return null;

    const canCreate = can(session.role, 'referral:create') && Boolean(session.facilityId);
    const openReferral = (id: string) => {
        setCreating(false);
        setOpenId(id);
        router.replace(`/referrals?id=${encodeURIComponent(id)}`, { scroll: false });
    };
    const close = () => {
        setOpenId(null);
        setCreating(false);
        router.replace('/referrals', { scroll: false });
    };

    const sidePanel = creating ? (
        <NewReferralForm session={session} onCreated={r => openReferral(r.id)} onCancel={close} />
    ) : openId ? (
        <ReferralDetail referralId={openId} session={session} onClose={close} onOpenReferral={openReferral} />
    ) : null;

    return (
        <div className="max-w-[1500px] mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-white border border-slate-300 p-3">
                <div>
                    <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        {ROLE_LABELS[session.role]} · {session.facilityName}
                    </p>
                    <h1 className="text-xl sm:text-2xl font-black text-[#1F3A6E] tracking-tight">Referrals between facilities</h1>
                    <p className="text-[12px] text-slate-600">
                        Created → Sent → Delivered → Acknowledged → Accepted / Rejected → Arrived → Admitted → Discharged.
                        Unacknowledged Emergencies escalate to the DHO after {REFERRAL_TIMING.EMERGENCY_ACK_MINUTES} minutes.
                    </p>
                </div>
                {canCreate && (
                    <button type="button" onClick={() => { setOpenId(null); setCreating(true); }} className="gov-btn gov-btn-primary text-sm shrink-0">
                        + New referral
                    </button>
                )}
            </div>

            <div className={`grid gap-4 items-start ${sidePanel ? 'xl:grid-cols-[minmax(0,1fr)_30rem]' : ''}`}>
                <ReferralBoard session={session} selectedId={openId} onOpen={openReferral} />
                {/* Rendered once: beside the board on wide screens, over it on phones. */}
                {sidePanel && (wide ? (
                    <div className="sticky top-40">{sidePanel}</div>
                ) : (
                    <div className="fixed inset-0 z-[55] bg-black/40 overflow-y-auto p-2 sm:p-6" role="dialog" aria-modal="true">
                        <div className="max-w-2xl mx-auto">{sidePanel}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ReferralsPage() {
    return (
        <div className="flex bg-bg-page min-h-screen font-sans text-txt-primary">
            <Sidebar />
            <main className="flex-1 p-3 md:p-5 overflow-y-auto min-w-0">
                <MobileMenu />
                <Suspense fallback={<p className="text-xs text-slate-600 p-6">Loading referrals…</p>}>
                    <ReferralsWorkspace />
                </Suspense>
            </main>
        </div>
    );
}
