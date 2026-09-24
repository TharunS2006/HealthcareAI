/**
 * Two-User Simulation — a Sub Centre ANM and a PHC Medical Officer, side by side.
 *
 * Each pane is the real app acting as that user: the same board, detail view,
 * bell and buttons, wrapped in its own session. Nothing here is faked for the
 * demo — a referral created on the left is saved, delivered, opened, accepted
 * and admitted through lib/referrals/workflow exactly as it would be on two
 * devices, and it stays in the district's records afterwards (the Command
 * Center shows it).
 *
 * "Run scripted demo" plays the whole flow step by step with short pauses,
 * driving the same store actions the buttons use. The escalation demo runs the
 * real escalation clock with a 20-second threshold, marked as such in the
 * timeline, so the DHO alert can be shown without waiting ten minutes.
 */

'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { SessionProvider } from '@/lib/auth/session';
import { ROLE_LABELS, can } from '@/lib/auth/permissions';
import { useDirectoryStore } from '@/stores/directoryStore';
import { useReferralStore } from '@/stores/referralStore';
import { useResourceStore } from '@/stores/resourceStore';
import { useAuthStore, type StaffSession } from '@/stores/authStore';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import * as wf from '@/lib/referrals/workflow';
import { REFERRAL_TIMING } from '@/lib/referrals/config';
import { requirementsFor } from '@/lib/capacity/requirements';
import { availabilityFor, capacityCheck } from '@/lib/capacity/availability';
import { WARD_LABELS } from '@/types/resources';
import NotificationBell from '@/components/notifications/NotificationBell';
import NotificationToaster from '@/components/notifications/NotificationToaster';
import { DeliveryReceiver } from '@/components/referrals/ReferralRuntime';
import ReferralBoard from '@/components/referrals/ReferralBoard';
import ReferralDetail from '@/components/referrals/ReferralDetail';
import NewReferralForm, { type ReferralFormPrefill } from '@/components/referrals/NewReferralForm';

type View = { mode: 'board' } | { mode: 'form'; prefill?: ReferralFormPrefill; signal?: number } | { mode: 'detail'; id: string };

const LEFT_USER = 'u-anm-kothi';
const RIGHT_USER = 'u-mo-bhamragad';

const STEPS = [
    'ANM registers the patient and fills in the referral',
    'ANM submits — the PHC device receives it (Sent) and the MO’s bell rings',
    'MO opens it — Delivered; the ANM sees “Seen by PHC at …”',
    'MO acknowledges — the ANM is notified',
    'MO checks capacity and accepts — a bed is reserved, the ANM gets the handover',
    'The two facilities exchange messages',
    'ANM dispatches the patient by 108',
    'Patient arrives — MO marks arrival and admits; bed counts update everywhere',
    'MO records treatment and discharges — the bed is freed',
] as const;

function sessionFor(userId: string, users: ReturnType<typeof useDirectoryStore.getState>['users']): StaffSession | null {
    const u = users.find(x => x.id === userId);
    if (!u) return null;
    const f = FACILITY_NETWORK.find(x => x.id === u.facilityId);
    return {
        userId: u.id,
        name: u.name,
        role: u.role,
        staffId: u.staffId,
        facilityId: u.facilityId,
        facilityName: f?.name ?? 'Unassigned',
        facilityType: f?.type ?? null,
        signedInAt: new Date().toISOString(),
    };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function Pane({ session, view, setView, tone }: { session: StaffSession; view: View; setView: (v: View) => void; tone: string }) {
    const open = (id: string) => setView({ mode: 'detail', id });
    return (
        <SessionProvider session={session}>
            <section className="relative border-2 border-[#1F3A6E] bg-[#F4F6FA] min-h-[640px] flex flex-col" aria-label={`${ROLE_LABELS[session.role]} pane`}>
                <DeliveryReceiver session={session} />
                <NotificationToaster session={session} mode="inline" onOpenReferral={open} />
                <header className={`${tone} text-white px-3 py-2 flex items-center justify-between gap-2`}>
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider font-bold text-white/80">{ROLE_LABELS[session.role]}</p>
                        <strong className="block text-[13px] leading-tight truncate">{session.name} · {session.facilityName}</strong>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {view.mode !== 'board' && (
                            <button type="button" onClick={() => setView({ mode: 'board' })} className="text-[11px] font-bold bg-white/15 hover:bg-white/25 px-2 py-1 rounded">
                                ← Board
                            </button>
                        )}
                        {can(session.role, 'referral:create') && view.mode === 'board' && (
                            <button type="button" onClick={() => setView({ mode: 'form' })} className="text-[11px] font-bold bg-white text-[#1F3A6E] px-2 py-1 rounded">
                                + New referral
                            </button>
                        )}
                        <NotificationBell session={session} onOpenReferral={open} compact />
                    </div>
                </header>
                <div className="p-2.5 space-y-2.5 flex-1 overflow-y-auto">
                    {view.mode === 'form' && (
                        <NewReferralForm
                            key={`form-${view.prefill ? 'scripted' : 'manual'}`}
                            session={session}
                            prefill={view.prefill}
                            submitSignal={view.signal}
                            onCreated={r => open(r.id)}
                            onCancel={() => setView({ mode: 'board' })}
                        />
                    )}
                    {view.mode === 'detail' && <ReferralDetail referralId={view.id} session={session} onClose={() => setView({ mode: 'board' })} onOpenReferral={open} />}
                    {view.mode === 'board' && <ReferralBoard session={session} onOpen={open} compact />}
                </div>
            </section>
        </SessionProvider>
    );
}

export default function SimulationPage() {
    const users = useDirectoryStore(s => s.users);
    const viewer = useAuthStore(s => s.session);
    const left = useMemo(() => sessionFor(LEFT_USER, users), [users]);
    const right = useMemo(() => sessionFor(RIGHT_USER, users), [users]);

    const [leftView, setLeftView] = useState<View>({ mode: 'board' });
    const [rightView, setRightView] = useState<View>({ mode: 'board' });
    const [step, setStep] = useState<number>(-1);
    const [running, setRunning] = useState(false);
    const [fast, setFast] = useState(false);
    const [escalation, setEscalation] = useState<null | { id: string; endsAt: number; done: boolean }>(null);
    const cancelled = useRef(false);

    if (!left || !right) {
        return <p className="p-6 text-sm text-slate-600">The simulation needs the seeded ANM (Sub Centre Village 1) and Medical Officer (PHC Block A) in the staff directory.</p>;
    }

    const pause = async (ms: number) => {
        await sleep(fast ? ms / 2 : ms);
        if (cancelled.current) throw new Error('stopped');
    };

    /** Waits until the store shows the referral in the given state (or times out). */
    const until = async (id: string, test: (r: NonNullable<ReturnType<typeof find>>) => boolean, label: string) => {
        for (let i = 0; i < 40; i++) {
            const r = find(id);
            if (r && test(r)) return r;
            await pause(150);
        }
        throw new Error(`Timed out waiting for: ${label}`);
    };
    const find = (id: string) => useReferralStore.getState().referrals.find(r => r.id === id);

    const must = async (p: Promise<{ ok: boolean; message?: string }>, label: string) => {
        const r = await p;
        if (!r.ok) throw new Error(`${label}: ${'message' in r ? r.message : ''}`);
    };

    const runScript = async () => {
        cancelled.current = false;
        setRunning(true);
        const store = useReferralStore.getState();
        const known = new Set(store.referrals.map(r => r.id));
        try {
            setStep(0);
            setRightView({ mode: 'board' });
            const prefill: ReferralFormPrefill = {
                newPatient: { name: 'Gangubai Madavi', age: '61', gender: 'F', village: 'Village 1' },
                spo2: '96', pulse: '118', systolic: '88', diastolic: '58', temperature: '99.0', respiratoryRate: '22',
                reason: 'Acute gastroenteritis — 12 watery stools since last night, unable to keep fluids down, BP 88/58. Severe dehydration: needs IV fluids and observation.',
                priority: 'EMERGENCY',
                transport: 'AMBULANCE_108',
                targetId: right.facilityId ?? undefined,
            };
            setLeftView({ mode: 'form', prefill });
            await pause(3200);

            setStep(1);
            setLeftView({ mode: 'form', prefill, signal: Date.now() });
            // The new referral is whichever id was not there before the submit.
            let id = '';
            for (let i = 0; i < 40 && !id; i++) {
                await pause(150);
                id = useReferralStore.getState().referrals.find(r => !known.has(r.id) && r.patientName === 'Gangubai Madavi')?.id ?? '';
            }
            if (!id) throw new Error('The referral was not created — see the form for the reason');
            await until(id, r => r.status !== 'CREATED', 'delivery to the PHC');
            await pause(2600);

            setStep(2);
            setRightView({ mode: 'detail', id });
            await until(id, r => r.status === 'DELIVERED', 'the MO opening the referral');
            await pause(1200);
            setLeftView({ mode: 'detail', id });
            await pause(2600);

            setStep(3);
            await must(store.act(id, { action: 'ACKNOWLEDGE' }, right), 'Acknowledge');
            await pause(2600);

            setStep(4);
            const current = find(id)!;
            const res = useResourceStore.getState();
            const avail = availabilityFor(current.toFacilityId, res.resources.find(r => r.facilityId === current.toFacilityId), res.tickets, useReferralStore.getState().referrals, Date.now());
            const check = capacityCheck(requirementsFor(wf.requirementInputOf(current)), avail);
            await must(
                store.act(id, {
                    action: 'ACCEPT',
                    reservation: check.bedAvailable && check.bedWard
                        ? { ward: check.bedWard, label: `${WARD_LABELS[check.bedWard]} ward bed`, handoverInstructions: `PHC ward, ${WARD_LABELS[check.bedWard]} bed. Keep IV fluids running; call on departure.` }
                        : undefined,
                    override: check.overall !== 'OK' ? { reason: 'Simulation: PHC capacity short — accepting to stabilise before onward transfer' } : undefined,
                }, right),
                'Accept'
            );
            await pause(3000);

            setStep(5);
            await must(store.comment(id, 'Bed held. Start ORS; if a line is possible, begin IV Ringer lactate before transfer.', right), 'MO message');
            await pause(1800);
            await must(store.comment(id, 'IV line secured, Ringer lactate running. Leaving with 108 now.', left), 'ANM reply');
            await pause(2200);

            setStep(6);
            await must(store.act(id, { action: 'DISPATCH', dispatch: { vehicleNo: 'MH-33-AMB-1087', etaMinutes: 25 } }, left), 'Dispatch');
            await pause(2800);

            setStep(7);
            await must(store.act(id, { action: 'MARK_ARRIVED' }, right), 'Arrival');
            await pause(1600);
            await must(store.act(id, { action: 'ADMIT' }, right), 'Admission');
            await pause(3000);

            setStep(8);
            await must(store.act(id, { action: 'TREATMENT_NOTE', note: '2 L Ringer lactate given, BP 110/70, passing urine. Tolerating ORS.' }, right), 'Treatment note');
            await pause(1600);
            await must(store.act(id, { action: 'DISCHARGE', note: 'Rehydrated and stable. ANM to review at home in 2 days.' }, right), 'Discharge');
            setStep(STEPS.length);
            toast.success('Scripted demo complete — the full referral is on both panes and in the Command Center');
        } catch (e) {
            const message = (e as Error).message;
            if (message !== 'stopped') toast.error(`Demo stopped: ${message}`, { duration: 8000 });
        } finally {
            setRunning(false);
        }
    };

    const runEscalation = async () => {
        const store = useReferralStore.getState();
        const thresholdSeconds = 20;
        const created = await store.create(
            {
                patient: { id: `p-sim-${Date.now().toString(36)}`, name: 'Rama Kowase', age: 34, gender: 'M' },
                from: { id: left.facilityId!, name: left.facilityName, type: 'SC' },
                to: { id: right.facilityId!, name: right.facilityName, type: 'PHC' },
                reason: 'Fall from tree 30 min ago — head injury, vomited twice, drowsy. Suspected fracture left forearm.',
                priority: 'EMERGENCY',
                transportMode: 'AMBULANCE_108',
                vitals: { spo2: 95, heartRate: 58, bloodPressure: { systolic: 150, diastolic: 90 }, consciousness: 'VOICE', injuryType: 'Head injury after fall' },
            },
            left
        );
        if (!created.ok) {
            toast.error(created.message);
            return;
        }
        const id = created.value.id;
        setLeftView({ mode: 'detail', id });
        setRightView({ mode: 'board' });
        const endsAt = Date.now() + thresholdSeconds * 1000;
        setEscalation({ id, endsAt, done: false });
        await sleep(thresholdSeconds * 1000 + 300);
        const ref = find(id);
        if (!ref || !['SENT', 'DELIVERED'].includes(ref.status)) {
            setEscalation(e => (e ? { ...e, done: true } : e));
            toast.success('The MO answered in time — nothing to escalate');
            return;
        }
        const minutes = thresholdSeconds / 60;
        await store.sweep(Date.now(), {
            timing: { EMERGENCY_ACK_MINUTES: minutes, EMERGENCY_REALERT_MINUTES: 60 },
            note: `simulation clock: ${thresholdSeconds} s threshold (live threshold ${REFERRAL_TIMING.EMERGENCY_ACK_MINUTES} min)`,
            onlyIds: [id],
        });
        setEscalation(e => (e ? { ...e, done: true } : e));
    };

    return (
        <div className="max-w-[1600px] mx-auto px-3 py-4 space-y-3">
            <div className="bg-white border border-slate-300 p-3 space-y-2">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Demo · Two-user simulation{viewer ? ` · opened by ${viewer.name}` : ''}</p>
                        <h1 className="text-xl sm:text-2xl font-black text-[#1F3A6E] tracking-tight">Sub Centre ANM ↔ PHC Medical Officer</h1>
                        <p className="text-[12px] text-slate-600 max-w-3xl">
                            Each pane is the real app signed in as that user. Act on one side and watch it arrive on the other —
                            notification, status change and acknowledgement. Records created here are real records on this device.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" disabled={running} onClick={() => void runScript()} className="gov-btn gov-btn-primary text-[12px] disabled:opacity-50">
                            ▶ Run scripted demo
                        </button>
                        {running && (
                            <button type="button" onClick={() => { cancelled.current = true; }} className="gov-btn gov-btn-secondary text-[12px]">Stop</button>
                        )}
                        <label className="flex items-center gap-1 text-[12px] text-slate-700">
                            <input type="checkbox" checked={fast} onChange={e => setFast(e.target.checked)} /> Faster
                        </label>
                        <button type="button" disabled={running || Boolean(escalation && !escalation.done)} onClick={() => void runEscalation()} className="gov-btn gov-btn-danger text-[12px] disabled:opacity-50">
                            Escalation demo (20 s clock)
                        </button>
                    </div>
                </div>

                <ol className="grid sm:grid-cols-3 xl:grid-cols-9 gap-1.5 text-[11px]">
                    {STEPS.map((label, i) => (
                        <li
                            key={label}
                            className={`border px-2 py-1.5 ${i < step ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : i === step ? 'bg-[#1F3A6E] border-[#1F3A6E] text-white font-bold' : 'bg-white border-slate-200 text-slate-500'}`}
                        >
                            <span className="font-mono mr-1">{i + 1}.</span>{label}
                        </li>
                    ))}
                </ol>
                {step >= STEPS.length && (
                    <p className="text-[12px] text-emerald-900 bg-emerald-50 border border-emerald-300 px-2 py-1">
                        Done. The referral&apos;s full timeline is on both panes.{' '}
                        {can(viewer?.role ?? null, 'command_center:view') && <Link href="/dashboard" className="underline font-bold">Open the Command Center</Link>}
                    </p>
                )}
                {escalation && (
                    <p className={`text-[12px] px-2 py-1 border ${escalation.done ? 'bg-red-50 border-red-300 text-red-900' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
                        {escalation.done
                            ? 'Escalated: the District Health Officer has been alerted and the MO reminded — see the timeline and the DHO’s bell. Acknowledging stops further alerts.'
                            : 'Emergency sent to the PHC and not acknowledged. The simulation clock escalates it in 20 seconds (the live threshold is 10 minutes). Acknowledge it in the right pane to prevent the escalation.'}
                    </p>
                )}
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
                <Pane session={left} view={leftView} setView={setLeftView} tone="bg-[#0F766E]" />
                <Pane session={right} view={rightView} setView={setRightView} tone="bg-[#1F3A6E]" />
            </div>
        </div>
    );
}
