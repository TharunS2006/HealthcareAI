/**
 * A patient's journey as it was recorded — registration, visits, every
 * referral event, lab orders and results — in time order.
 *
 * The record screen used to draw the same five steps for every patient, at
 * fixed offsets from registration: "analysis completed" one minute later,
 * "synced via mesh" at two, "Transport assigned" by a "Command Center" at
 * three, "handover" at fifteen. None of those had happened; on a record a
 * clinician acts from, they read as facts. Every entry here is something a
 * person or the referral workflow actually wrote down, with who and when.
 * scripts/verify-metrics.mts checks it.
 */

import type { Patient } from '@/types/patient';
import type { DiagnosticOrder } from '@/types/facility';
import type { ReferralRecord } from '@/types/patient';
import { ACTION_LABELS } from '@/lib/referrals/workflow';

export interface TimelineEntry {
    at: Date;
    kind: 'REGISTERED' | 'VISIT' | 'REFERRAL' | 'LAB_ORDER' | 'LAB_RESULT';
    title: string;
    detail?: string;
    actor?: string;
}

const when = (v: Date | string | undefined): Date | null => {
    if (v === undefined || v === null) return null;
    const d = new Date(v);
    return Number.isFinite(d.getTime()) ? d : null;
};

export function patientTimeline(
    patient: Patient,
    referrals: readonly ReferralRecord[],
    diagnostics: readonly Pick<DiagnosticOrder, 'patientId' | 'testName' | 'orderedAt' | 'orderedBy' | 'facilityName' | 'completedAt' | 'resultSummary' | 'isAbnormal'>[] = [],
): TimelineEntry[] {
    const out: TimelineEntry[] = [];
    const push = (at: Date | null, entry: Omit<TimelineEntry, 'at'>) => {
        if (at) out.push({ at, ...entry });
    };

    push(when(patient.timestamp), {
        kind: 'REGISTERED',
        title: 'Registered',
        detail: patient.triageStatus ? `Triage ${patient.triageStatus}` : undefined,
        actor: patient.chw_name,
    });

    for (const v of patient.visits ?? []) {
        push(when(v.date), {
            kind: 'VISIT',
            title: `Visit — ${v.facilityName}`,
            detail: [v.chiefComplaint, v.triageStatus ? `triage ${v.triageStatus}` : '', v.diagnosis ? `diagnosis: ${v.diagnosis}` : '']
                .filter(Boolean).join(' · ') || undefined,
            actor: v.attendingStaff,
        });
    }

    for (const r of referrals.filter(x => x.patientId === patient.id)) {
        const route = `${r.fromFacilityName} → ${r.toFacilityName}`;
        if (r.timeline?.length) {
            for (const e of r.timeline) {
                push(when(e.at), {
                    kind: 'REFERRAL',
                    title: `${ACTION_LABELS[e.action] ?? e.action} — ${route}`,
                    detail: e.note,
                    actor: e.actor?.name,
                });
            }
        } else {
            // A referral from before the event log: its own timestamps are all there is.
            push(when(r.referredAt), { kind: 'REFERRAL', title: `Referral created — ${route}`, detail: r.reason, actor: r.referredBy });
            push(when(r.acceptedAt), { kind: 'REFERRAL', title: `Accepted — ${route}` });
            push(when(r.rejectedAt), { kind: 'REFERRAL', title: `Rejected — ${route}` });
            push(when(r.arrivedAt), { kind: 'REFERRAL', title: `Patient arrived — ${r.toFacilityName}` });
            push(when(r.admittedAt), { kind: 'REFERRAL', title: `Admitted — ${r.toFacilityName}` });
            push(when(r.dischargedAt), { kind: 'REFERRAL', title: `Discharged — ${r.toFacilityName}` });
        }
    }

    for (const d of diagnostics.filter(x => x.patientId === patient.id)) {
        push(when(d.orderedAt), { kind: 'LAB_ORDER', title: `Lab test ordered — ${d.testName}`, detail: d.facilityName, actor: d.orderedBy });
        if (d.resultSummary) {
            push(when(d.completedAt), {
                kind: 'LAB_RESULT',
                title: `Lab result${d.isAbnormal ? ' (abnormal)' : ''} — ${d.testName}`,
                detail: d.resultSummary,
            });
        }
    }

    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
