/**
 * Facility resources and the maintenance log — the right-hand side of every
 * capacity check.
 *
 * Only Hospital Admins (for their own facility) and Super Admin may edit beds,
 * staff on duty and maintenance tickets; the one exception is occupancy moved
 * by a referral's admission or discharge, which follows from a clinical action
 * the referral workflow already authorised. Every write is audited and
 * published to other tabs and devices, so the Command Center and the referral
 * form see a ventilator go down within seconds of it being reported.
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
    adjustOccupancy,
    getAllResources,
    getMaintenanceTickets,
    saveMaintenanceTicket,
    saveResources,
    storeFromMesh,
} from '@/lib/db';
import { can, isDistrictWide } from '@/lib/auth/permissions';
import { auditActorOf } from '@/lib/auth/session';
import { publishResources, publishTicket, wireOf, type WireActor } from '@/lib/referrals/transport';
import type { StaffSession } from './authStore';
import type {
    FacilityResources,
    MaintenanceTarget,
    MaintenanceTicket,
    Specialty,
    WardType,
} from '@/types/resources';
import type { ResourceDelta } from '@/lib/referrals/workflow';

const wire = (s: StaffSession): WireActor => wireOf(s)!;

const STATUS_RANK: Record<MaintenanceTicket['status'], number> = { OPEN: 0, ASSIGNED: 1, RESOLVED: 2 };

function assertMay(session: StaffSession, facilityId: string, permission: 'capacity:manage' | 'maintenance:manage'): void {
    if (!can(session.role, permission)) throw new Error(`${session.role} may not change facility resources`);
    if (!isDistrictWide(session.role) && session.facilityId !== facilityId) {
        throw new Error('You can only change the resources of your own facility');
    }
}

export interface NewTicketInput {
    facilityId: string;
    target: MaintenanceTarget;
    units: number;
    severity: MaintenanceTicket['severity'];
    description: string;
    expectedRepairDate?: string;
}

interface ResourceStore {
    resources: FacilityResources[];
    tickets: MaintenanceTicket[];
    loaded: boolean;
    load: () => Promise<void>;
    updateWard: (facilityId: string, ward: WardType, patch: { total?: number; occupied?: number }, session: StaffSession) => Promise<void>;
    setStaffOnDuty: (facilityId: string, specialty: Specialty, count: number, session: StaffSession) => Promise<void>;
    reportIssue: (input: NewTicketInput, session: StaffSession) => Promise<MaintenanceTicket>;
    assignIssue: (ticketId: string, assignee: string, expectedRepairDate: string | undefined, session: StaffSession) => Promise<void>;
    resolveIssue: (ticketId: string, note: string, session: StaffSession) => Promise<void>;
    /** Admission (+1) or discharge (−1). Throws if the ward is unknown — see adjustOccupancy. */
    applyOccupancy: (delta: ResourceDelta, session: StaffSession, referralId: string) => Promise<void>;
    ingestResources: (resources: FacilityResources) => Promise<void>;
    ingestTicket: (ticket: MaintenanceTicket) => Promise<void>;
}

export const useResourceStore = create<ResourceStore>((set, get) => {
    const put = (next: FacilityResources) =>
        set(state => ({ resources: [...state.resources.filter(r => r.facilityId !== next.facilityId), next] }));
    const putTicket = (next: MaintenanceTicket) =>
        set(state => ({
            tickets: [next, ...state.tickets.filter(t => t.id !== next.id)].sort((a, b) => Date.parse(b.reportedAt) - Date.parse(a.reportedAt)),
        }));
    const resourcesOf = (facilityId: string) => {
        const r = get().resources.find(x => x.facilityId === facilityId);
        if (!r) throw new Error('This facility has not reported its resources');
        return r;
    };

    return {
        resources: [],
        tickets: [],
        loaded: false,

        load: async () => {
            try {
                const [resources, tickets] = await Promise.all([getAllResources(), getMaintenanceTickets()]);
                set({ resources, tickets, loaded: true });
            } catch (error) {
                console.error('Failed to load facility resources:', error);
                // Left empty on purpose: every capacity check then reads UNKNOWN,
                // which the screens show as "not reported", never as free beds.
                set({ loaded: true });
            }
        },

        updateWard: async (facilityId, ward, patch, session) => {
            assertMay(session, facilityId, 'capacity:manage');
            const current = resourcesOf(facilityId);
            const line = current.wards.find(w => w.ward === ward);
            const total = patch.total ?? line?.total ?? 0;
            const occupied = patch.occupied ?? line?.occupied ?? 0;
            if (!Number.isInteger(total) || total < 0) throw new Error('Total beds must be a whole number, 0 or more');
            if (!Number.isInteger(occupied) || occupied < 0) throw new Error('Occupied beds must be a whole number, 0 or more');
            if (occupied > total) throw new Error(`Occupied (${occupied}) cannot exceed the ward's total (${total})`);
            const next: FacilityResources = {
                ...current,
                wards: line
                    ? current.wards.map(w => (w.ward === ward ? { ward, total, occupied } : w))
                    : [...current.wards, { ward, total, occupied }],
                updatedAt: new Date().toISOString(),
                updatedBy: session.name,
            };
            await saveResources(next, `${ward} BEDS → ${occupied}/${total}`);
            put(next);
            void publishResources(next, wire(session), 'MANAGE');
        },

        setStaffOnDuty: async (facilityId, specialty, count, session) => {
            assertMay(session, facilityId, 'capacity:manage');
            if (!Number.isInteger(count) || count < 0) throw new Error('Staff on duty must be a whole number, 0 or more');
            const current = resourcesOf(facilityId);
            const has = current.staffOnDuty.some(s => s.specialty === specialty);
            const next: FacilityResources = {
                ...current,
                staffOnDuty: has
                    ? current.staffOnDuty.map(s => (s.specialty === specialty ? { specialty, count } : s))
                    : [...current.staffOnDuty, { specialty, count }],
                updatedAt: new Date().toISOString(),
                updatedBy: session.name,
            };
            await saveResources(next, `STAFF ${specialty} → ${count}`);
            put(next);
            void publishResources(next, wire(session), 'MANAGE');
        },

        reportIssue: async (input, session) => {
            assertMay(session, input.facilityId, 'maintenance:manage');
            const current = resourcesOf(input.facilityId);
            const description = input.description.trim();
            if (description.length < 3) throw new Error('Describe the issue');
            if (!Number.isInteger(input.units) || input.units < 1) throw new Error('Affected units must be at least 1');
            const held = input.target.kind === 'BEDS'
                ? current.wards.find(w => w.ward === (input.target as { ward: WardType }).ward)?.total
                : current.equipment.find(e => e.kind === (input.target as { equipment: string }).equipment)?.units;
            if (held === undefined) throw new Error('This facility does not hold that ward or equipment');
            if (input.units > held) throw new Error(`Only ${held} ${input.target.kind === 'BEDS' ? 'beds' : 'units'} exist`);
            const ticket: MaintenanceTicket = {
                id: `mt-${uuidv4().slice(0, 8)}`,
                facilityId: input.facilityId,
                target: input.target,
                units: input.units,
                severity: input.severity,
                description,
                status: 'OPEN',
                reportedAt: new Date().toISOString(),
                reportedBy: session.name,
                ...(input.expectedRepairDate ? { expectedRepairDate: input.expectedRepairDate } : {}),
            };
            await saveMaintenanceTicket(ticket, 'REPORTED');
            putTicket(ticket);
            void publishTicket(ticket, wire(session));
            return ticket;
        },

        assignIssue: async (ticketId, assignee, expectedRepairDate, session) => {
            const ticket = get().tickets.find(t => t.id === ticketId);
            if (!ticket) throw new Error('Ticket not found');
            assertMay(session, ticket.facilityId, 'maintenance:manage');
            if (ticket.status === 'RESOLVED') throw new Error('This issue is already resolved');
            if (!assignee.trim()) throw new Error('Name who it is assigned to');
            const next: MaintenanceTicket = {
                ...ticket,
                status: 'ASSIGNED',
                assignedTo: assignee.trim(),
                assignedAt: new Date().toISOString(),
                ...(expectedRepairDate ? { expectedRepairDate } : {}),
            };
            await saveMaintenanceTicket(next, `ASSIGNED → ${next.assignedTo}`);
            putTicket(next);
            void publishTicket(next, wire(session));
        },

        resolveIssue: async (ticketId, note, session) => {
            const ticket = get().tickets.find(t => t.id === ticketId);
            if (!ticket) throw new Error('Ticket not found');
            assertMay(session, ticket.facilityId, 'maintenance:manage');
            if (ticket.status === 'RESOLVED') return;
            const next: MaintenanceTicket = {
                ...ticket,
                status: 'RESOLVED',
                resolvedAt: new Date().toISOString(),
                resolvedBy: session.name,
                ...(note.trim() ? { resolutionNote: note.trim() } : {}),
            };
            await saveMaintenanceTicket(next, 'RESOLVED');
            putTicket(next);
            void publishTicket(next, wire(session));
        },

        applyOccupancy: async (delta, session, referralId) => {
            const next = await adjustOccupancy(delta.facilityId, delta.ward, delta.occupied, auditActorOf(session), referralId);
            put(next);
            void publishResources(next, wire(session), 'OCCUPANCY');
        },

        ingestResources: async (incoming) => {
            const local = get().resources.find(r => r.facilityId === incoming.facilityId);
            if (local && Date.parse(local.updatedAt) >= Date.parse(incoming.updatedAt)) return;
            try {
                await storeFromMesh('facilityResources', incoming);
                put(incoming);
            } catch (error) {
                console.error('Failed to store resources from the mesh:', error);
            }
        },

        ingestTicket: async (incoming) => {
            const local = get().tickets.find(t => t.id === incoming.id);
            // Tickets only move forward (open → assigned → resolved), so the
            // copy further along wins; ties keep what is here.
            if (local && STATUS_RANK[local.status] >= STATUS_RANK[incoming.status] && JSON.stringify(local) === JSON.stringify(incoming)) return;
            if (local && STATUS_RANK[local.status] > STATUS_RANK[incoming.status]) return;
            try {
                await storeFromMesh('maintenanceLog', incoming);
                putTicket(incoming);
            } catch (error) {
                console.error('Failed to store a maintenance ticket from the mesh:', error);
            }
        },
    };
});
