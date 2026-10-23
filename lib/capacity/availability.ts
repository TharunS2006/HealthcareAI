/**
 * What a facility has free right now, and whether that meets a referral.
 *
 *   available beds = total − occupied − under maintenance − reserved
 *
 * where "under maintenance" is the sum of open bed tickets and "reserved" is
 * the number of accepted referrals holding a bed that has not expired. Neither
 * is stored — both are derived here from the records that cause them, so
 * resolving a ticket or releasing a reservation returns the capacity with no
 * counter to forget.
 *
 * THREE STATES, NEVER TWO
 * -----------------------
 * Every check answers OK, SHORT or UNKNOWN. A facility that has not reported
 * its resources is UNKNOWN on every line — never a reassuring green — because
 * "we could not tell" and "they have it" must not look alike to the person
 * deciding where a patient goes.
 *
 * Verified by scripts/verify-capacity.mts.
 */

import type { Facility } from '../../types/facility';
import type { ReferralRecord } from '../../types/patient';
import type {
    EquipmentKind,
    EquipmentStatus,
    FacilityResources,
    MaintenanceTicket,
    Specialty,
    WardType,
} from '../../types/resources';
import { EQUIPMENT_LABELS, SPECIALTY_LABELS, WARD_LABELS } from '../../types/resources';
import type { ResourceRequirements } from './requirements';
import { roadDistanceKm } from '../analytics/facilityMetrics';

export interface WardAvailability {
    ward: WardType;
    total: number;
    occupied: number;
    maintenance: number;
    reserved: number;
    /** Never negative; see `overBy` for a ward admitted past its beds. */
    available: number;
    /** Beds in use beyond the ward's total (admissions on a capacity override). */
    overBy: number;
}

export interface EquipmentAvailability {
    kind: EquipmentKind;
    units: number;
    working: number;
    underMaintenance: number;
    outOfOrder: number;
    status: EquipmentStatus;
    /** Earliest promised repair among open tickets. */
    expectedRepairDate?: string;
}

export interface FacilityAvailability {
    facilityId: string;
    /** False when the facility has no resource record — every check is UNKNOWN. */
    reported: boolean;
    wards: Partial<Record<WardType, WardAvailability>>;
    equipment: Partial<Record<EquipmentKind, EquipmentAvailability>>;
    staff: Partial<Record<Specialty, number>>;
    totalBeds: number;
    occupiedBeds: number;
    reservedBeds: number;
    availableBeds: number;
    updatedAt?: string;
}

const isOpen = (t: MaintenanceTicket) => t.status !== 'RESOLVED';

/**
 * Does this referral currently hold a bed at this facility?
 *
 * A hold counts while the patient is on the way and has not run out its
 * window, and keeps counting once they have arrived and are waiting to be
 * admitted — an arrived patient's bed must not look free to the next referral.
 */
export function holdsBed(ref: ReferralRecord, facilityId: string, now: number): boolean {
    const r = ref.reservation;
    if (!r || r.state !== 'HELD' || r.facilityId !== facilityId) return false;
    if (ref.status === 'PATIENT_ARRIVED') return true;
    return ref.status === 'ACCEPTED' && Date.parse(r.expiresAt) > now;
}

export function availabilityFor(
    facilityId: string,
    resources: FacilityResources | undefined,
    tickets: readonly MaintenanceTicket[],
    referrals: readonly ReferralRecord[],
    now: number
): FacilityAvailability {
    if (!resources) {
        return {
            facilityId,
            reported: false,
            wards: {},
            equipment: {},
            staff: {},
            totalBeds: 0,
            occupiedBeds: 0,
            reservedBeds: 0,
            availableBeds: 0,
        };
    }

    const open = tickets.filter(t => t.facilityId === facilityId && isOpen(t));
    const held = referrals.filter(r => holdsBed(r, facilityId, now));

    const wards: Partial<Record<WardType, WardAvailability>> = {};
    let totalBeds = 0, occupiedBeds = 0, reservedBeds = 0, availableBeds = 0;
    for (const w of resources.wards) {
        const maintenance = open
            .filter(t => t.target.kind === 'BEDS' && t.target.ward === w.ward)
            .reduce((sum, t) => sum + Math.max(0, t.units), 0);
        const reserved = held.filter(r => r.reservation!.ward === w.ward).length;
        const raw = w.total - w.occupied - maintenance - reserved;
        const entry: WardAvailability = {
            ward: w.ward,
            total: w.total,
            occupied: w.occupied,
            maintenance,
            reserved,
            available: Math.max(0, raw),
            overBy: Math.max(0, -raw),
        };
        wards[w.ward] = entry;
        totalBeds += w.total;
        occupiedBeds += w.occupied;
        reservedBeds += reserved;
        availableBeds += entry.available;
    }

    const equipment: Partial<Record<EquipmentKind, EquipmentAvailability>> = {};
    for (const line of resources.equipment) {
        const mine = open.filter(t => t.target.kind === 'EQUIPMENT' && t.target.equipment === line.kind);
        const underMaintenance = mine.filter(t => t.severity === 'UNDER_MAINTENANCE').reduce((s, t) => s + t.units, 0);
        const outOfOrder = mine.filter(t => t.severity === 'OUT_OF_ORDER').reduce((s, t) => s + t.units, 0);
        const working = Math.max(0, line.units - underMaintenance - outOfOrder);
        const repairDates = mine.map(t => t.expectedRepairDate).filter((d): d is string => Boolean(d)).sort();
        equipment[line.kind] = {
            kind: line.kind,
            units: line.units,
            working,
            underMaintenance,
            outOfOrder,
            // A line reads as down only when nothing works; a partial outage is
            // shown through the counts, not by flipping the whole line red.
            status: working > 0 ? 'WORKING' : outOfOrder >= underMaintenance && outOfOrder > 0 ? 'OUT_OF_ORDER' : 'UNDER_MAINTENANCE',
            expectedRepairDate: repairDates[0],
        };
    }

    const staff: Partial<Record<Specialty, number>> = {};
    for (const s of resources.staffOnDuty) staff[s.specialty] = (staff[s.specialty] ?? 0) + Math.max(0, s.count);

    return {
        facilityId,
        reported: true,
        wards,
        equipment,
        staff,
        totalBeds,
        occupiedBeds,
        reservedBeds,
        availableBeds,
        updatedAt: resources.updatedAt,
    };
}

/**
 * The ward a bed requirement is actually drawn from at this facility.
 *
 * Emergency and paediatric admissions fall back to General beds where the
 * facility has no such ward at all — a PHC stabilises an emergency in its
 * general beds. Maternity and ICU never fall back: those are capabilities,
 * not just beds, and a general bed does not provide them.
 */
export function resolveWard(ward: WardType, availability: FacilityAvailability): { ward: WardType; fellBack: boolean } {
    const has = (w: WardType) => (availability.wards[w]?.total ?? 0) > 0;
    if (has(ward)) return { ward, fellBack: false };
    if ((ward === 'EMERGENCY' || ward === 'PEDIATRIC') && has('GENERAL')) return { ward: 'GENERAL', fellBack: true };
    return { ward, fellBack: false };
}

export type CheckState = 'OK' | 'SHORT' | 'UNKNOWN';

export interface CheckItem {
    key: string;
    kind: 'BED' | 'EQUIPMENT' | 'SPECIALIST';
    required: string;
    why: string;
    available: string;
    state: CheckState;
}

export interface CapacityCheck {
    items: CheckItem[];
    overall: CheckState;
    /** The ward a reservation would be made in, when a bed is required and free. */
    bedWard: WardType | null;
    bedAvailable: boolean;
    bedRequired: boolean;
}

export function capacityCheck(req: ResourceRequirements, availability: FacilityAvailability): CapacityCheck {
    const items: CheckItem[] = [];
    let bedWard: WardType | null = null;
    let bedAvailable = false;

    if (req.bed) {
        if (!availability.reported) {
            items.push({ key: 'bed', kind: 'BED', required: `${WARD_LABELS[req.bed.ward]} bed`, why: req.bed.reason, available: 'Not reported', state: 'UNKNOWN' });
        } else {
            const resolved = resolveWard(req.bed.ward, availability);
            const w = availability.wards[resolved.ward];
            bedWard = resolved.ward;
            bedAvailable = Boolean(w && w.available > 0);
            const label = resolved.fellBack
                ? `${WARD_LABELS[req.bed.ward]} bed (no ${WARD_LABELS[req.bed.ward]} ward — General beds)`
                : `${WARD_LABELS[req.bed.ward]} bed`;
            items.push({
                key: 'bed',
                kind: 'BED',
                required: label,
                why: req.bed.reason,
                available: w
                    ? `${w.available} free of ${w.total}` + (w.maintenance ? ` · ${w.maintenance} under maintenance` : '') + (w.reserved ? ` · ${w.reserved} reserved` : '')
                    : 'No such ward',
                state: bedAvailable ? 'OK' : 'SHORT',
            });
        }
    }

    for (const e of req.equipment) {
        const a = availability.equipment[e.kind];
        let state: CheckState;
        let text: string;
        if (!availability.reported) { state = 'UNKNOWN'; text = 'Not reported'; }
        else if (!a) { state = 'SHORT'; text = 'Not held here'; }
        else if (a.working > 0) {
            state = 'OK';
            text = `${a.working} of ${a.units} working`;
        } else {
            state = 'SHORT';
            text = a.status === 'OUT_OF_ORDER' ? 'Out of order' : 'Under maintenance';
            if (a.expectedRepairDate) text += ` · repair by ${a.expectedRepairDate}`;
        }
        items.push({ key: `eq-${e.kind}`, kind: 'EQUIPMENT', required: EQUIPMENT_LABELS[e.kind], why: e.reason, available: text, state });
    }

    for (const s of req.specialists) {
        const n = availability.staff[s.specialty];
        const state: CheckState = !availability.reported ? 'UNKNOWN' : (n ?? 0) > 0 ? 'OK' : 'SHORT';
        items.push({
            key: `sp-${s.specialty}`,
            kind: 'SPECIALIST',
            required: SPECIALTY_LABELS[s.specialty],
            why: s.reason,
            available: !availability.reported ? 'Not reported' : (n ?? 0) > 0 ? `${n} on duty` : 'None on duty this shift',
            state,
        });
    }

    const overall: CheckState = items.some(i => i.state === 'SHORT')
        ? 'SHORT'
        : items.some(i => i.state === 'UNKNOWN')
        ? 'UNKNOWN'
        : 'OK';

    return { items, overall, bedWard, bedAvailable, bedRequired: Boolean(req.bed) };
}

export interface AlternativeFacility {
    facility: Facility;
    check: CapacityCheck;
    distanceKm: number;
}

/**
 * Where else this patient could go. Facilities that meet every requirement
 * come first, nearest first from the referring facility; partial matches
 * follow so the sender always has a next call to make. Sub Centres are never
 * suggested — they do not admit.
 */
export function suggestAlternatives(
    req: ResourceRequirements,
    origin: Facility,
    facilities: readonly Facility[],
    availabilityOf: (facilityId: string) => FacilityAvailability,
    exclude: readonly string[]
): AlternativeFacility[] {
    const rank: Record<CheckState, number> = { OK: 0, UNKNOWN: 1, SHORT: 2 };
    return facilities
        .filter(f => f.type !== 'SC' && f.id !== origin.id && !exclude.includes(f.id))
        .map(f => ({
            facility: f,
            check: capacityCheck(req, availabilityOf(f.id)),
            distanceKm: roadDistanceKm(origin.location, f.location),
        }))
        .sort((a, b) => rank[a.check.overall] - rank[b.check.overall] || a.distanceKm - b.distanceKm);
}

const TIER_RANK: Record<Facility['type'], number> = { SC: 0, PHC: 1, CHC: 2, SDH: 3, DH: 4 };

/** Facilities a referral may go to: a higher tier than the one sending it. */
export function referralTargets(req: ResourceRequirements, origin: Facility, facilities: readonly Facility[], availabilityOf: (facilityId: string) => FacilityAvailability): AlternativeFacility[] {
    const lowerOrSame = facilities.filter(f => TIER_RANK[f.type] <= TIER_RANK[origin.type]).map(f => f.id);
    return suggestAlternatives(req, origin, facilities, availabilityOf, lowerOrSame);
}

/**
 * Where a referral goes by default: the facility above this one, unless its
 * reported beds, equipment or specialists show it cannot take this patient —
 * then the nearest that can, then the nearest at all. The OPD's automatic RED
 * referral and the referral form both use this, so the two never disagree.
 */
export function defaultReferralTarget(options: readonly AlternativeFacility[], origin: Facility): AlternativeFacility | undefined {
    return options.find(o => o.facility.id === origin.parentFacilityId && o.check.overall !== 'SHORT')
        ?? options.find(o => o.check.overall === 'OK')
        ?? options[0];
}

/** Occupancy as a whole-number percentage, counting held beds as taken. */
export function occupancyPct(a: FacilityAvailability): number | null {
    if (!a.reported || a.totalBeds === 0) return null;
    return Math.round(((a.totalBeds - a.availableBeds) / a.totalBeds) * 100);
}

/** Equipment lines with nothing working — the "don't send here for X" list. */
export function equipmentDown(a: FacilityAvailability): EquipmentAvailability[] {
    return Object.values(a.equipment).filter((e): e is EquipmentAvailability => Boolean(e && e.working === 0));
}

