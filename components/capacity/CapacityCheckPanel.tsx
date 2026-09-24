/**
 * Required against available, line by line — what the receiving facility
 * reads before it accepts a patient.
 */

'use client';

import type { CapacityCheck } from '@/lib/capacity/availability';
import { CheckMark } from '@/components/referrals/Badges';

interface Props {
    check: CapacityCheck;
    facilityName: string;
    /** When the resources were last updated, if known. */
    updatedAt?: string;
}

const KIND_LABEL = { BED: 'Bed', EQUIPMENT: 'Equipment', SPECIALIST: 'Specialist' } as const;

export default function CapacityCheckPanel({ check, facilityName, updatedAt }: Props) {
    const summary =
        check.overall === 'OK'
            ? { text: 'Everything this referral needs is available.', style: 'bg-emerald-50 border-emerald-300 text-emerald-900' }
            : check.overall === 'SHORT'
            ? { text: 'Shortfall — see the red lines. Accepting needs a recorded reason.', style: 'bg-red-50 border-red-300 text-red-900' }
            : { text: 'Capacity not reported — this cannot be confirmed from the system.', style: 'bg-slate-50 border-slate-300 text-slate-800' };

    return (
        <section className="border border-[#B9C5D6] bg-white" aria-label="Capacity check">
            <div className="bg-[#EDF1F7] border-b border-[#B9C5D6] px-3 py-1.5 flex items-baseline justify-between gap-2">
                <h3 className="text-[12px] font-bold text-[#1F3A6E]">Capacity check — {facilityName}</h3>
                {updatedAt && <span className="text-[10px] text-slate-500">resources updated {new Date(updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
            <p className={`mx-3 mt-2 px-2 py-1.5 border text-[11px] font-semibold ${summary.style}`}>{summary.text}</p>
            {check.items.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-slate-600">Outpatient referral — no bed, equipment or specialist required.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="gov-table w-full text-[11px] mt-2">
                        <thead>
                            <tr>
                                <th className="text-left">Required</th>
                                <th className="text-left">Why</th>
                                <th className="text-left">Available now</th>
                                <th className="text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {check.items.map(item => (
                                <tr key={item.key}>
                                    <td className="font-semibold">
                                        <span className="block text-[9px] uppercase text-slate-500">{KIND_LABEL[item.kind]}</span>
                                        {item.required}
                                    </td>
                                    <td className="text-slate-600">{item.why}</td>
                                    <td>{item.available}</td>
                                    <td><CheckMark state={item.state} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}
