/**
 * Live availability of candidate facilities for one referral — shown before
 * sending, and again when a referral is rejected and must go elsewhere.
 * Facilities that meet every need come first, nearest first.
 */

'use client';

import type { AlternativeFacility } from '@/lib/capacity/availability';
import { equipmentDown, occupancyPct, type FacilityAvailability } from '@/lib/capacity/availability';
import { EQUIPMENT_LABELS, WARD_LABELS } from '@/types/resources';
import { CheckMark } from '@/components/referrals/Badges';

interface Props {
    options: AlternativeFacility[];
    availabilityOf: (facilityId: string) => FacilityAvailability;
    selectedId?: string;
    onSelect?: (facilityId: string) => void;
    /** Label for the per-row action when there is no radio selection (e.g. "Re-route here"). */
    actionLabel?: string;
    onAction?: (facilityId: string) => void;
    emptyText?: string;
}

export default function FacilityAvailabilityList({ options, availabilityOf, selectedId, onSelect, actionLabel, onAction, emptyText }: Props) {
    if (options.length === 0) {
        return <p className="text-[11px] text-slate-600 px-1 py-2">{emptyText ?? 'No other facility to suggest.'}</p>;
    }
    return (
        <ul className="border border-[#B9C5D6] divide-y divide-slate-200 bg-white" role={onSelect ? 'radiogroup' : undefined}>
            {options.map(({ facility, check, distanceKm }) => {
                const a = availabilityOf(facility.id);
                const pct = occupancyPct(a);
                const down = equipmentDown(a);
                const bedLine = check.bedRequired && check.bedWard
                    ? `${a.wards[check.bedWard]?.available ?? 0} ${WARD_LABELS[check.bedWard]} bed${(a.wards[check.bedWard]?.available ?? 0) === 1 ? '' : 's'} free`
                    : check.bedRequired
                    ? 'Required ward not reported'
                    : 'No bed needed';
                const selected = selectedId === facility.id;
                const short = check.items.filter(i => i.state === 'SHORT').map(i => i.required);
                const body = (
                    <div className="flex items-start justify-between gap-2 w-full">
                        <div className="min-w-0">
                            <strong className="block text-[12px] text-[#1F3A6E]">{facility.name} <span className="font-mono text-[10px] text-slate-500">({facility.type})</span></strong>
                            <span className="block text-[11px] text-slate-600">
                                {distanceKm.toFixed(0)} km · {a.reported ? bedLine : 'Resources not reported'}
                                {pct !== null ? ` · ${pct}% occupied` : ''}
                            </span>
                            {short.length > 0 && <span className="block text-[11px] text-red-700">Short: {short.join(', ')}</span>}
                            {down.length > 0 && (
                                <span className="block text-[11px] text-amber-800">
                                    Down: {down.map(d => `${EQUIPMENT_LABELS[d.kind]}${d.expectedRepairDate ? ` (until ${d.expectedRepairDate})` : ''}`).join(', ')}
                                </span>
                            )}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-1">
                            <CheckMark state={check.overall} />
                            {onAction && actionLabel && (
                                <button type="button" onClick={() => onAction(facility.id)} className="text-[11px] font-bold text-white bg-[#1F3A6E] hover:bg-[#16294E] px-2 py-1 rounded">
                                    {actionLabel}
                                </button>
                            )}
                        </div>
                    </div>
                );
                return (
                    <li key={facility.id} className={selected ? 'bg-blue-50' : ''}>
                        {onSelect ? (
                            <label className="flex items-start gap-2 px-3 py-2 cursor-pointer">
                                <input type="radio" name="target-facility" checked={selected} onChange={() => onSelect(facility.id)} className="mt-1" />
                                {body}
                            </label>
                        ) : (
                            <div className="px-3 py-2">{body}</div>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
