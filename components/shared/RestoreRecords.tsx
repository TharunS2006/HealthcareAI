/**
 * Restore a facility's patient records from the district service.
 *
 * Shown when this device lacks some of the records the district service holds
 * for the signed-in user's facility — a phone that replaced a lost or broken
 * one, or one that was reset. Silent otherwise, and whenever the question
 * cannot be asked (offline, signed in on this device only, no posting). Asking
 * costs a list of ids, not the records. Records already on the device are never
 * overwritten (lib/sync/restore.ts).
 */

'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useIsSessionOverridden, useSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/permissions';
import { FACILITY_NETWORK } from '@/lib/data/facilities';
import { countMissing, restoreFacilityPatients } from '@/lib/sync/restore';
import { usePatientStore } from '@/stores/patientStore';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function RestoreRecords() {
    const session = useSession();
    // The tab's own session only: the district service is asked with its token.
    const own = !useIsSessionOverridden();
    const facilityId = session?.facilityId ?? null;
    const eligible = own && Boolean(session?.token && facilityId && can(session.role, 'patient:register'));
    const loadPatients = usePatientStore(s => s.loadPatients);
    const [missing, setMissing] = useState<{ count: number; total: number } | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!eligible || !facilityId) return;
        let alive = true;
        countMissing(facilityId).then(result => {
            if (alive && result.ok && result.missing > 0) setMissing({ count: result.missing, total: result.total });
        });
        return () => { alive = false; };
    }, [eligible, facilityId]);

    if (!eligible || !facilityId || !missing) return null;
    const facilityName = FACILITY_NETWORK.find(f => f.id === facilityId)?.name ?? facilityId;

    const restore = async () => {
        setBusy(true);
        const result = await restoreFacilityPatients(facilityId);
        await loadPatients();
        setBusy(false);
        if (result.restored > 0) toast.success(`${plural(result.restored, 'patient record')} restored from the district service`);
        if (!result.ok) {
            toast.error('The restore stopped: the district service could not be reached. What arrived is kept — try again when connected.');
            const left = missing.count - result.restored;
            setMissing(left > 0 ? { ...missing, count: left } : null);
            return;
        }
        setMissing(null);
    };

    return (
        <section className="bg-white border border-[#B9C5D6] border-l-4 border-l-[#1F3A6E] p-3" aria-labelledby="restore-records">
            <h2 id="restore-records" className="text-sm font-extrabold text-[#1F3A6E]">This device is missing patient records</h2>
            <p className="text-[12px] text-slate-700 mt-1">
                The district service holds {plural(missing.total, 'patient record')} for {facilityName}, and{' '}
                {missing.count === missing.total ? 'none of them are' : `${missing.count} of them are not`} on this device — on a
                replacement phone, that is the facility&rsquo;s history. Restoring downloads only what is missing; nothing
                already on this device is changed.
            </p>
            <button type="button" onClick={() => void restore()} disabled={busy} className="mt-2 gov-btn gov-btn-primary text-[12px] disabled:opacity-60">
                {busy ? 'Restoring…' : `Restore ${plural(missing.count, 'record')}`}
            </button>
        </section>
    );
}
