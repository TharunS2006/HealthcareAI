'use client';

/**
 * Pilot measures for the district (lib/pilot/metrics.ts): how the tool's triage
 * compares with the clinician's, and how long referrals take — from the records
 * on this device, with a de-identified export for the study team.
 */

import { useEffect, useMemo } from 'react';
import { usePatientStore } from '@/stores/patientStore';
import { useReferralStore } from '@/stores/referralStore';
import { pilotCsv, pilotSummary } from '@/lib/pilot/metrics';

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : 'not recorded');
const minutes = (m: number | null) => (m === null ? 'not recorded' : `${m} min`);

export default function PilotStudyPanel() {
    const patients = usePatientStore(s => s.patients);
    const loadPatients = usePatientStore(s => s.loadPatients);
    const referrals = useReferralStore(s => s.referrals);
    const referralsLoaded = useReferralStore(s => s.loaded);
    const loadReferrals = useReferralStore(s => s.loadReferrals);

    useEffect(() => {
        if (patients.length === 0) void loadPatients();
    }, [patients.length, loadPatients]);
    useEffect(() => {
        if (!referralsLoaded) void loadReferrals();
    }, [referralsLoaded, loadReferrals]);

    const s = useMemo(() => pilotSummary(patients, referrals), [patients, referrals]);

    const download = () => {
        const blob = new Blob([pilotCsv(patients, referrals)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nalammesh-pilot-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const tiles = [
        { label: 'Clinician reviews', value: `${s.reviews}`, note: 'triage results a clinician rated' },
        { label: 'Under-triage', value: pct(s.under, s.reviews), note: `${s.under} rated less urgent by the tool than by the clinician` },
        { label: 'Over-triage', value: pct(s.over, s.reviews), note: `${s.over} rated more urgent by the tool` },
        { label: 'RED caught', value: pct(s.toolRedOfClinicianRed, s.clinicianRed), note: `${s.toolRedOfClinicianRed} of ${s.clinicianRed} the clinician rated RED` },
        { label: 'Referral → acknowledged', value: minutes(s.medianMinutesToAcknowledge), note: `median of ${s.acknowledged} of ${s.referrals} referrals` },
        { label: 'Referral → arrival', value: minutes(s.medianMinutesToArrival), note: `median of ${s.arrived} of ${s.referrals} referrals` },
    ];

    return (
        <section aria-labelledby="pilot-heading" className="border border-border-subtle bg-white">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border-subtle px-4 py-3">
                <div>
                    <p className="text-[0.625rem] font-bold uppercase tracking-wider text-gov-navy">Supervised pilot</p>
                    <h2 id="pilot-heading" className="text-sm font-extrabold text-emerald-deep">Triage agreement and referral times</h2>
                    <p className="text-[0.6875rem] text-txt-secondary mt-0.5 max-w-3xl">
                        From the records on this device. The measures in docs/pilot/VALIDATION_PROTOCOL.md: the clinician&apos;s
                        own triage is the reference; under-triage is the safety measure.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={download}
                    disabled={s.reviews === 0}
                    className="border border-gov-navy bg-gov-navy px-3 py-2 text-xs font-bold text-white hover:bg-gov-navy-hover disabled:opacity-60"
                >
                    Download de-identified CSV
                </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {tiles.map(t => (
                    <div key={t.label} className="border border-gov-blue-border bg-gov-blue-bg p-3 text-gov-navy">
                        <p className="text-[0.625rem] font-bold uppercase tracking-wider">{t.label}</p>
                        <p className="text-xl font-extrabold tabular-nums leading-tight mt-0.5">{t.value}</p>
                        <p className="text-[0.6875rem] leading-snug mt-0.5">{t.note}</p>
                    </div>
                ))}
            </div>
            <p className="border-t border-border-subtle px-4 py-3 text-[0.6875rem] leading-relaxed text-txt-secondary">
                The export has no name, ID, phone, ABHA number, village or exact age, but rows from a small facility can
                still identify a patient: share it only with the study team named in the ethics approval.
            </p>
        </section>
    );
}
