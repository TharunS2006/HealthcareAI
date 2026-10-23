/**
 * Refresh the official Rural Health Statistics figures — `npm run fetch:rhs`
 *
 * Pulls two datasets from the Open Government Data Platform (data.gov.in) API
 * and writes lib/data/official/rhs.json, the only source of the Command
 * Center's "Official context" panel. The app never calls data.gov.in at run
 * time: the figures ship with the build, with their provenance, and work offline.
 *
 * Key: DATA_GOV_IN_API_KEY (free, from a data.gov.in account). Without one this
 * uses the public sample key data.gov.in publishes for trying its API, which
 * returns 10 records per call — the script pages through.
 */

import { writeFileSync } from 'node:fs';

const KEY = process.env.DATA_GOV_IN_API_KEY?.trim() || '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';
const PAGE = 10;

const DATASETS = {
    rhs2022: {
        resourceId: 'f1cd67be-1623-4e43-8410-d71bea7ba11d',
        page: 'https://www.data.gov.in/resource/stateut-wise-total-number-primary-health-centres-phcs-sub-health-centres-shcs-and-district',
    },
    rhs2021: {
        resourceId: '4e3c855c-c10c-479e-ae6e-187bfed35ac1',
        page: 'https://www.data.gov.in/resource/stateuts-wise-number-phcs-primary-health-centre-chcs-community-health-centres-functioning',
    },
} as const;

const num = (v: unknown): number => {
    const n = Number(String(v ?? '').replace(/,/g, '').trim());
    if (!Number.isFinite(n) || n < 0) throw new Error(`Not a count: ${JSON.stringify(v)}`);
    return n;
};

async function fetchAll(resourceId: string) {
    const records: Record<string, unknown>[] = [];
    let meta: Record<string, unknown> = {};
    for (let offset = 0; ; offset += PAGE) {
        const url = `https://api.data.gov.in/resource/${resourceId}?api-key=${KEY}&format=json&limit=${PAGE}&offset=${offset}`;
        let res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        // The shared sample key is rate-limited: back off and retry rather than fail.
        for (let attempt = 1; res.status === 429 && attempt <= 6; attempt++) {
            await new Promise(r => setTimeout(r, 5000 * attempt));
            res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        }
        if (!res.ok) throw new Error(`${resourceId}: HTTP ${res.status}`);
        await new Promise(r => setTimeout(r, 1500));
        const body = (await res.json()) as Record<string, unknown> & { records?: Record<string, unknown>[]; total?: number };
        if (offset === 0) meta = body;
        records.push(...(body.records ?? []));
        if (!body.records?.length || records.length >= Number(body.total)) break;
    }
    if (records.length !== Number(meta.total)) throw new Error(`${resourceId}: got ${records.length} of ${meta.total} records`);
    return { meta, records };
}

const a = await fetchAll(DATASETS.rhs2022.resourceId);
const b = await fetchAll(DATASETS.rhs2021.resourceId);
const source = (d: typeof DATASETS[keyof typeof DATASETS], meta: Record<string, unknown>) => ({
    title: meta.title,
    publisher: (meta.org as string[] | undefined)?.join(', '),
    resourceId: d.resourceId,
    page: d.page,
    api: `https://api.data.gov.in/resource/${d.resourceId}`,
    publishedOnPortal: meta.created_date ?? meta.updated_date,
});

const out = {
    retrievedAt: new Date().toISOString(),
    portal: 'Open Government Data (OGD) Platform India — data.gov.in',
    infrastructure2022: {
        source: source(DATASETS.rhs2022, a.meta),
        rows: a.records.map(r => ({
            state: String(r.state_ut).trim(),
            subHealthCentres: num(r.sub_health_centres__shcs_),
            phcs: num(r.primary_health_centres__phcs_),
            districtHospitals: num(r.district_hospitals),
        })),
    },
    phcChc2021: {
        source: source(DATASETS.rhs2021, b.meta),
        rows: b.records.map(r => ({
            state: String(r.state_ut).trim(),
            phcsRural: num(r.phcs___rural), phcsUrban: num(r.phcs___urban), phcsTotal: num(r.phcs___total),
            chcsRural: num(r.chcs___rural), chcsUrban: num(r.chcs___urban), chcsTotal: num(r.chcs___total),
        })),
    },
};

writeFileSync(new URL('../lib/data/official/rhs.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(`Wrote lib/data/official/rhs.json — ${out.infrastructure2022.rows.length} + ${out.phcChc2021.rows.length} rows, retrieved ${out.retrievedAt}`);
