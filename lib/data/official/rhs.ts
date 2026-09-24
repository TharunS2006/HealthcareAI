/**
 * Official Rural Health Statistics, from data.gov.in.
 *
 * rhs.json is written by `npm run fetch:rhs` (scripts/fetch-rhs.mts) from two
 * datasets on the Open Government Data Platform — both Rajya Sabha answers
 * quoting the Ministry of Health's Rural Health Statistics — and is committed,
 * so these figures ship with the app and need no connection. Nothing here is
 * estimated: counts are as published; the only derived values are two ratios,
 * each labelled with its basis.
 *
 * @module lib/data/official/rhs
 */

import raw from './rhs.json';

export interface OfficialSource {
    title: string;
    publisher: string;
    resourceId: string;
    page: string;
    api: string;
    publishedOnPortal: string;
}

export interface StateHealthInfrastructure {
    state: string;
    /** RHS 2021-22. */
    subHealthCentres: number | null;
    phcs: number | null;
    districtHospitals: number | null;
    /** RHS 2020-21. */
    phcsRural: number | null;
    phcsUrban: number | null;
    chcsRural: number | null;
    chcsUrban: number | null;
    chcsTotal: number | null;
    /** SHCs per PHC, both RHS 2021-22 (all PHCs, rural and urban). */
    shcPerPhc: number | null;
    /** Rural PHCs per rural CHC, both RHS 2020-21. */
    ruralPhcPerRuralChc: number | null;
}

/**
 * RHS population norms for plain areas — one Sub-Centre per 5,000, one PHC per
 * 30,000, one CHC per 1,20,000 — which imply about 6 Sub-Centres per PHC and
 * 4 PHCs per CHC. Hilly, tribal and difficult areas have lower population norms.
 */
export const RHS_NORMS = { populationPerSubCentre: 5000, populationPerPhc: 30000, populationPerChc: 120000, subCentresPerPhc: 6, phcsPerChc: 4 } as const;

/** Spelling differences between the two published files, mapped to one name. */
const NAME_FIX: Record<string, string> = { 'Andaman and Nicobar Isalnds': 'Andaman and Nicobar Islands' };
const clean = (name: string) => NAME_FIX[name] ?? name;
const ratio = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? Math.round((a / b) * 10) / 10 : null);

export const RHS_SOURCES: { infrastructure2022: OfficialSource; phcChc2021: OfficialSource; retrievedAt: string; portal: string } = {
    infrastructure2022: raw.infrastructure2022.source as OfficialSource,
    phcChc2021: raw.phcChc2021.source as OfficialSource,
    retrievedAt: raw.retrievedAt,
    portal: raw.portal,
};

export const ALL_INDIA = 'All India';

function build(): StateHealthInfrastructure[] {
    const y22 = new Map(raw.infrastructure2022.rows.map(r => [clean(r.state), r]));
    const y21 = new Map(raw.phcChc2021.rows.map(r => [clean(r.state), r]));
    // 2021-22 publishes a Total row; 2020-21 does not, so its all-India figure is the sum of states.
    const total21 = raw.phcChc2021.rows.reduce(
        (t, r) => ({ phcsRural: t.phcsRural + r.phcsRural, phcsUrban: t.phcsUrban + r.phcsUrban, chcsRural: t.chcsRural + r.chcsRural, chcsUrban: t.chcsUrban + r.chcsUrban, chcsTotal: t.chcsTotal + r.chcsTotal }),
        { phcsRural: 0, phcsUrban: 0, chcsRural: 0, chcsUrban: 0, chcsTotal: 0 }
    );
    const names = [...new Set([...y22.keys(), ...y21.keys()])].filter(n => n !== 'Total').sort((a, b) => a.localeCompare(b));
    const row = (state: string, a: (typeof raw.infrastructure2022.rows)[number] | undefined, b: typeof total21 | undefined): StateHealthInfrastructure => ({
        state,
        subHealthCentres: a?.subHealthCentres ?? null,
        phcs: a?.phcs ?? null,
        districtHospitals: a?.districtHospitals ?? null,
        phcsRural: b?.phcsRural ?? null,
        phcsUrban: b?.phcsUrban ?? null,
        chcsRural: b?.chcsRural ?? null,
        chcsUrban: b?.chcsUrban ?? null,
        chcsTotal: b?.chcsTotal ?? null,
        shcPerPhc: ratio(a?.subHealthCentres, a?.phcs),
        ruralPhcPerRuralChc: ratio(b?.phcsRural, b?.chcsRural),
    });
    return [row(ALL_INDIA, y22.get('Total'), total21), ...names.map(n => row(n, y22.get(n), y21.get(n)))];
}

export const RHS_BY_STATE: readonly StateHealthInfrastructure[] = build();

export function rhsFor(state: string): StateHealthInfrastructure | undefined {
    return RHS_BY_STATE.find(r => r.state === state);
}
