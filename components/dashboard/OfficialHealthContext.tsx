/**
 * Official context for the Command Center: the state's public health
 * infrastructure as the Ministry's Rural Health Statistics report it, from
 * data.gov.in (lib/data/official/rhs.ts) — beside the live network above, so a
 * District Health Officer reads the district against the state it sits in.
 */

'use client';

import { useState } from 'react';
import { DEPLOYMENT } from '@/lib/config/deployment';
import { ALL_INDIA, RHS_BY_STATE, RHS_NORMS, RHS_SOURCES, rhsFor } from '@/lib/data/official/rhs';

const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-IN'));

/**
 * A ratio against its norm. Which side is a gap depends on the ratio: fewer
 * Sub-Centres per PHC than the norm means too few Sub-Centres; more PHCs per
 * CHC than the norm means too few CHCs.
 */
function Ratio({ label, value, norm, basis, gapWhen, gapText }: {
    label: string; value: number | null; norm: number; basis: string; gapWhen: 'below' | 'above'; gapText: string;
}) {
    const gap = value != null && (gapWhen === 'below' ? value < norm : value > norm);
    return (
        <div className="border border-slate-200 bg-white px-3 py-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
            <span className="text-lg font-bold text-[#1F3A6E]">{value ?? '—'}</span>
            <span className={`ml-2 text-[11px] font-semibold ${gap ? 'text-amber-700' : 'text-slate-600'}`}>norm ≈ {norm}</span>
            {gap && <span className="block text-[11px] font-semibold text-amber-800">{gapText}</span>}
            <span className="block text-[10px] text-slate-500">{basis}</span>
        </div>
    );
}

export default function OfficialHealthContext() {
    const initial = rhsFor(DEPLOYMENT.statisticsState)?.state ?? ALL_INDIA;
    const [state, setState] = useState(initial);
    const r = rhsFor(state) ?? RHS_BY_STATE[0];

    return (
        <section className="border border-[#B9C5D6] bg-white" aria-labelledby="official-context">
            <div className="bg-[#1F3A6E] text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <h2 id="official-context" className="text-[13px] font-bold">Official context — Rural Health Statistics</h2>
                <label className="text-[11px] flex items-center gap-1.5">
                    State / UT
                    <select value={state} onChange={e => setState(e.target.value)} className="text-slate-900 text-[12px] rounded px-1 py-0.5">
                        {RHS_BY_STATE.map(s => <option key={s.state} value={s.state}>{s.state}</option>)}
                    </select>
                </label>
            </div>
            <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    {[
                        ['Sub-Health Centres', r.subHealthCentres, '2021-22'],
                        ['Primary Health Centres', r.phcs, '2021-22'],
                        ['Community Health Centres', r.chcsTotal, '2020-21'],
                        ['District Hospitals', r.districtHospitals, '2021-22'],
                    ].map(([label, value, year]) => (
                        <div key={label as string} className="border border-slate-200 bg-[#F8FAFC] px-2 py-2">
                            <span className="block text-xl font-bold text-[#1F3A6E]">{fmt(value as number | null)}</span>
                            <span className="block text-[11px] font-semibold text-slate-700">{label}</span>
                            <span className="block text-[10px] text-slate-500">RHS {year}</span>
                        </div>
                    ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                    <Ratio label="Sub-Health Centres per PHC" value={r.shcPerPhc} norm={RHS_NORMS.subCentresPerPhc} gapWhen="below"
                        gapText="Fewer Sub-Centres per PHC than the norm structure" basis="RHS 2021-22, all PHCs (rural and urban)" />
                    <Ratio label="Rural PHCs per rural CHC" value={r.ruralPhcPerRuralChc} norm={RHS_NORMS.phcsPerChc} gapWhen="above"
                        gapText="Fewer CHCs than the norm implies for this many PHCs" basis={`RHS 2020-21 — ${fmt(r.phcsRural)} rural PHCs, ${fmt(r.chcsRural)} rural CHCs`} />
                </div>
                <p className="text-[11px] text-slate-600">
                    Norms: one Sub-Centre per {RHS_NORMS.populationPerSubCentre.toLocaleString('en-IN')}, one PHC per {RHS_NORMS.populationPerPhc.toLocaleString('en-IN')} and one CHC
                    per {RHS_NORMS.populationPerChc.toLocaleString('en-IN')} population in plain areas (lower in hilly and tribal areas) — about{' '}
                    {RHS_NORMS.subCentresPerPhc} Sub-Centres per PHC and {RHS_NORMS.phcsPerChc} PHCs per CHC.
                </p>
                <p className="text-[10px] text-slate-500 border-t border-slate-200 pt-2">
                    Source: {RHS_SOURCES.portal} —{' '}
                    <a href={RHS_SOURCES.infrastructure2022.page} target="_blank" rel="noreferrer" className="underline">{RHS_SOURCES.infrastructure2022.title}</a>;{' '}
                    <a href={RHS_SOURCES.phcChc2021.page} target="_blank" rel="noreferrer" className="underline">{RHS_SOURCES.phcChc2021.title}</a>.
                    Published by {RHS_SOURCES.infrastructure2022.publisher}; retrieved {RHS_SOURCES.retrievedAt.slice(0, 10)}.
                </p>
            </div>
        </section>
    );
}
