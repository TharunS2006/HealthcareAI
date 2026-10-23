/**
 * Restore a facility's patient records onto this device from the district service.
 *
 * A phone that replaces a lost or broken one starts empty. Its predecessor
 * uploaded every patient it registered or changed (lib/sync/outbox.ts), so the
 * facility's history is at the district service. This finds which of those
 * records this device lacks — by id, before downloading any — and saves only
 * those. A record the device already holds is never overwritten: the device is
 * the source of truth, and its copy is at least as new as the one it uploaded.
 *
 * Restored records are saved straight to IndexedDB, not through the outbox:
 * they came from the service, so sending them back would be a loop.
 */

import { getAllPatients, getPatient, savePatient } from '@/lib/db';
import type { Patient } from '@/types/patient';
import { fetchFacilityPatients, type FacilityPatientsResult } from './cloudRecords';

type Failure = Extract<FacilityPatientsResult, { ok: false }>;

const ID_PAGE = 2000;
const RECORD_PAGE = 500;

/** The ids the service holds that the device does not. */
export function missingIds(onDevice: Iterable<string>, atService: readonly string[]): string[] {
    const held = new Set(onDevice);
    return atService.filter(id => !held.has(id));
}

async function serviceIds(facilityId: string): Promise<{ ok: true; ids: string[] } | Failure> {
    const ids: string[] = [];
    for (let offset = 0; ; offset += ID_PAGE) {
        const page = await fetchFacilityPatients(facilityId, { idsOnly: true, offset, limit: ID_PAGE });
        if (!page.ok) return page;
        ids.push(...page.ids);
        if (page.ids.length < ID_PAGE || ids.length >= page.total) return { ok: true, ids };
    }
}

/** How many of the facility's records at the district service this device lacks. */
export async function countMissing(facilityId: string): Promise<{ ok: true; missing: number; total: number } | Failure> {
    const found = await serviceIds(facilityId);
    if (!found.ok) return found;
    const local = (await getAllPatients()).map(p => p.id);
    return { ok: true, missing: missingIds(local, found.ids).length, total: found.ids.length };
}

/**
 * Download and save the facility's records this device lacks. Resolves to how
 * many were restored; a failure part-way keeps what was already saved.
 */
export async function restoreFacilityPatients(facilityId: string): Promise<{ ok: true; restored: number } | (Failure & { restored: number })> {
    const found = await serviceIds(facilityId);
    if (!found.ok) return { ...found, restored: 0 };
    const wanted = new Set(missingIds((await getAllPatients()).map(p => p.id), found.ids));
    let restored = 0;
    for (let offset = 0; wanted.size > 0 && offset < found.ids.length; offset += RECORD_PAGE) {
        const page = await fetchFacilityPatients(facilityId, { offset, limit: RECORD_PAGE });
        if (!page.ok) return { ...page, restored };
        for (const patient of page.patients as Patient[]) {
            if (!patient?.id || !wanted.has(patient.id)) continue;
            // Re-checked at the moment of saving: the device may have received or
            // registered this patient since the list was read.
            if (await getPatient(patient.id)) { wanted.delete(patient.id); continue; }
            await savePatient({ ...patient, isSynced: true });
            wanted.delete(patient.id);
            restored += 1;
        }
    }
    return { ok: true, restored };
}
