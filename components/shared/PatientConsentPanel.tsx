'use client';

/**
 * A patient's data notice and consent on their record: what was recorded, and
 * — for an emergency registration (pending) or a record made before this step
 * existed — a way to give the notice and record consent now.
 */

import { useState } from 'react';
import toast from 'react-hot-toast';
import type { Patient } from '@/types/patient';
import type { StaffSession } from '@/stores/authStore';
import { can } from '@/lib/auth/permissions';
import { usePatientStore } from '@/stores/patientStore';
import { buildConsent, consentProblems, consentStatus, EMPTY_CONSENT, type ConsentDraft } from '@/lib/consent/dataConsent';
import DataConsentFields, { consentSummary } from '@/components/shared/DataConsentFields';

export default function PatientConsentPanel({ patient, session, onSaved }: {
    patient: Patient;
    session: StaffSession | null;
    onSaved: (updated: Patient) => void;
}) {
    const updatePatient = usePatientStore(s => s.updatePatient);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<ConsentDraft>({ ...EMPTY_CONSENT, language: patient.languagePreference ?? 'mr' });
    const [problems, setProblems] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    const status = consentStatus(patient);
    const mayRecord = Boolean(session && can(session.role, 'patient:register'));

    const save = async () => {
        if (!session) return;
        const found = consentProblems(draft, patient.age, false);
        setProblems(found);
        if (found.length > 0) return;
        setSaving(true);
        const updated: Patient = { ...patient, isSynced: false, dataConsent: buildConsent(draft, { staffId: session.staffId, name: session.name }, new Date(), patient.dataConsent) };
        try {
            await updatePatient(updated);
        } catch {
            toast.error('The consent could not be saved on this device — try again');
            setSaving(false);
            return;
        }
        setSaving(false);
        setOpen(false);
        onSaved(updated);
        toast.success('Notice and consent recorded');
    };

    const tone = status === 'RECORDED' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900';
    return (
        <section aria-labelledby="consent-heading" className={`border rounded-xl p-4 text-sm ${tone}`}>
            <h2 id="consent-heading" className="font-bold">Data notice and consent</h2>
            {status === 'RECORDED' && patient.dataConsent && <p className="mt-1">{consentSummary(patient.dataConsent)}</p>}
            {status === 'PENDING' && patient.dataConsent && (
                <p className="mt-1">Registered as a medical emergency on {new Date(patient.dataConsent.emergencyAt ?? patient.dataConsent.recordedAt).toLocaleString('en-IN')}. Give the notice and record consent once the patient or a guardian can hear it.</p>
            )}
            {status === 'NOT_RECORDED' && <p className="mt-1">Not recorded — this record was made before the notice step. Give the notice and record consent at the next visit.</p>}

            {status !== 'RECORDED' && mayRecord && !open && (
                <button type="button" onClick={() => setOpen(true)} className="mt-2 px-3 py-1.5 rounded bg-[#1F3A6E] text-white text-xs font-bold">
                    Record notice and consent
                </button>
            )}
            {open && (
                <div className="mt-3 bg-white rounded p-3 text-slate-800">
                    <DataConsentFields idPrefix="record" value={draft} onChange={setDraft} lang="en" allowEmergency={false} />
                    {problems.length > 0 && (
                        <ul role="alert" className="mt-2 list-disc pl-5 text-xs text-red-800">
                            {problems.map(p => <li key={p}>{p}</li>)}
                        </ul>
                    )}
                    <div className="mt-2 flex gap-2">
                        <button type="button" disabled={saving} onClick={save} className="px-3 py-1.5 rounded bg-[#1F3A6E] text-white text-xs font-bold disabled:opacity-60">
                            {saving ? 'Saving…' : 'Save consent'}
                        </button>
                        <button type="button" onClick={() => { setOpen(false); setProblems([]); }} className="px-3 py-1.5 rounded border border-slate-300 text-xs font-bold text-slate-800">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
