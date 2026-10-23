/**
 * The referral network as the facility records describe it — District
 * Hospital down to the Sub-Centres, each under the facility it refers to.
 *
 * This panel used to be drawn by hand: seven named facilities with fixed bed
 * counts ("235/300", "ICU 16/20"), doctor and ambulance numbers, "Online 24x7"
 * and "7 Nodes Connected", whatever the records said. Everything here now
 * comes from the facility list (Super Admin edits it at /admin; bed reports
 * update it), nested by parentFacilityId, and a figure that is not reported is
 * left out rather than invented. No online badge: nothing in a facility record
 * says whether its device is reachable right now.
 */

'use client';

import type { Facility, FacilityType } from '@/types/facility';

const TIER_ORDER: FacilityType[] = ['DH', 'SDH', 'CHC', 'PHC', 'SC'];
const rank = (t: FacilityType) => {
    const i = TIER_ORDER.indexOf(t);
    return i === -1 ? TIER_ORDER.length : i;
};

interface Props {
    facilities: readonly Facility[];
    /** Highlight the signed-in user's own facility. */
    currentFacilityId?: string | null;
    language: 'en' | 'hi' | 'mr';
}

export default function FacilityTree({ facilities, currentFacilityId, language }: Props) {
    const isEn = language === 'en';
    const isHi = language === 'hi';
    const byId = new Map(facilities.map(f => [f.id, f]));
    const children = new Map<string, Facility[]>();
    const roots: Facility[] = [];
    for (const f of facilities) {
        const parent = f.parentFacilityId && f.parentFacilityId !== f.id ? byId.get(f.parentFacilityId) : undefined;
        if (parent) children.set(parent.id, [...(children.get(parent.id) ?? []), f]);
        else roots.push(f);
    }
    const sorted = (list: Facility[]) => [...list].sort((a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name));

    const facts = (f: Facility): string[] => {
        const out: string[] = [];
        if (f.beds?.total > 0) out.push(`${isEn ? 'Beds' : isHi ? 'बिस्तर' : 'खाटा'} ${f.beds.occupied}/${f.beds.total}`);
        if (f.beds?.icu && f.beds.icu.total > 0) out.push(`ICU ${f.beds.icu.occupied}/${f.beds.icu.total}`);
        if (f.staff?.doctors > 0) out.push(`${f.staff.doctors} ${isEn ? (f.staff.doctors === 1 ? 'doctor' : 'doctors') : isHi ? 'डॉक्टर' : 'डॉक्टर'}`);
        if (f.ambulanceAvailable > 0) out.push(`${f.ambulanceAvailable} ${isEn ? (f.ambulanceAvailable === 1 ? 'ambulance' : 'ambulances') : isHi ? 'एम्बुलेंस' : 'रुग्णवाहिका'}`);
        return out;
    };

    // Guards against a cycle in parentFacilityId, which would otherwise recurse forever.
    const render = (f: Facility, depth: number, seen: Set<string>): React.ReactNode => {
        if (seen.has(f.id)) return null;
        const next = new Set(seen).add(f.id);
        const kids = sorted(children.get(f.id) ?? []);
        const own = f.id === currentFacilityId;
        return (
            <li key={f.id} className={depth > 0 ? 'pl-4 border-l-2 border-slate-300' : ''}>
                <div className={`p-2.5 rounded border ${depth === 0 ? 'bg-[#1F3A6E] text-white border-[#11223F]' : own ? 'bg-slate-50 border-[#1F3A6E]' : 'bg-white border-slate-300'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold mr-1.5 ${depth === 0 ? 'bg-white/15 text-amber-300' : 'bg-slate-200 text-slate-800'}`}>{f.type}</span>
                            <span className={`font-bold text-xs ${depth === 0 ? 'text-white' : 'text-[#1F3A6E]'}`}>{f.name}</span>
                            {facts(f).length > 0 && (
                                <span className={`block text-[10px] mt-0.5 ${depth === 0 ? 'text-slate-300' : 'text-txt-muted'}`}>{facts(f).join(' • ')}</span>
                            )}
                        </div>
                        {own && (
                            <span className="text-[10px] font-bold text-[#1F3A6E]">{isEn ? 'Your facility' : isHi ? 'आपका केंद्र' : 'तुमचे केंद्र'}</span>
                        )}
                    </div>
                </div>
                {kids.length > 0 && <ul className="mt-2 space-y-2">{kids.map(k => render(k, depth + 1, next))}</ul>}
            </li>
        );
    };

    if (facilities.length === 0) {
        return <p className="text-xs text-txt-muted">{isEn ? 'No facilities on this device yet.' : isHi ? 'इस डिवाइस पर अभी कोई केंद्र नहीं।' : 'या उपकरणावर अद्याप कोणतेही केंद्र नाही.'}</p>;
    }
    return <ul className="space-y-3">{sorted(roots).map(r => render(r, 0, new Set()))}</ul>;
}
