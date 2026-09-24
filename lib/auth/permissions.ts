/**
 * Who may do what — the single place roles are defined.
 *
 * Every gate in the app reads this file: the route guard decides what to admit
 * from it, the sidebar and header decide which links exist from it, the
 * referral workflow decides which actions are legal from it, and the mesh relay
 * refuses events that break it. Editing a role here changes the app everywhere
 * — a permission spelled out inline in a component is a permission nobody can
 * audit, and in a referral system "who was allowed to reject this patient?"
 * must have exactly one answer.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not security. The session is mock auth held in the browser, and anyone with
 * devtools can claim any role. What this is, is a correct model of the
 * hierarchy: it keeps a Sub Centre ANM off a district bed board and keeps every
 * screen honest about whose data is whose. Permissions are named after
 * capabilities, not screens, so the same names carry over unchanged to a real
 * server-side check (the relay and the district service already use them).
 *
 * TWO QUESTIONS, NOT ONE
 * ----------------------
 * A permission answers "may this role do this at all". Facility scoping answers
 * "to whose patients". A Medical Officer may accept referrals — only those
 * addressed to their own PHC. Only DISTRICT_WIDE_ROLES read across facilities.
 */

import type { FacilityType } from '@/types/patient';

/** The six roles of the referral hierarchy, HSC → PHC → CHC/DH → District. */
export type StaffRole =
    | 'ANM'
    | 'MO'
    | 'HOSPITAL_ADMIN'
    | 'SPECIALIST'
    | 'DHO'
    | 'SUPER_ADMIN';

export const STAFF_ROLES: readonly StaffRole[] = [
    'ANM',
    'MO',
    'HOSPITAL_ADMIN',
    'SPECIALIST',
    'DHO',
    'SUPER_ADMIN',
];

/**
 * Capabilities, named after the act rather than the page that hosts it.
 * "referral:accept_reject" survives the screen being redesigned or split;
 * "can_see_incoming_page" would not.
 */
export type Permission =
    // Staff workspace — every signed-in role holds this
    | 'staff:workspace'
    // Patient care
    | 'patient:register'
    | 'patient:vitals'
    | 'patient:view'
    | 'treatment:notes'
    // Referral lifecycle
    | 'referral:view'            // open the referral screen at all (scoped)
    | 'referral:create'          // raise and forward a referral, re-route after rejection
    | 'referral:receive'         // see everything addressed to own facility, incl. unanswered
    | 'referral:acknowledge'
    | 'referral:accept_reject'
    | 'referral:escalate'        // raise an onward referral to CHC / DH
    | 'referral:arrival'         // mark PATIENT_ARRIVED and ADMITTED
    | 'referral:discharge'
    | 'referral:comment'
    // Facility resources
    | 'capacity:view'            // live availability of other facilities (referral form)
    | 'resources:view'           // open the facility resources screen (read-only)
    | 'capacity:manage'          // edit beds and staff on duty
    | 'maintenance:manage'       // report / assign / resolve equipment and bed issues
    // Oversight
    | 'command_center:view'
    | 'analytics:view'
    | 'audit:view'
    | 'data:inspect'
    // Facility operations
    | 'queue:manage'
    | 'appointments:manage'
    | 'stock:manage'
    | 'diagnostics:manage'
    | 'teleconsult:use'
    | 'followup:manage'
    | 'dashboard:my'
    // System administration
    | 'admin:users'
    | 'admin:roles'
    | 'admin:facilities'
    | 'demo:simulate';

/**
 * The grant per role. Mirrors the spec table one row at a time; anything a
 * role holds beyond its row is noted with the reason.
 */
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
    // Sub Centre. Registers patients, records vitals, raises and forwards
    // referrals, follows what happened to them. Cannot accept or reject — a
    // referral is answered by the facility receiving it, never the sender.
    // Also: follow-ups and assisted teleconsult, which are ANM field duties the
    // app already supported before RBAC, and capacity:view so the referral form
    // can show which target has a bed before she sends.
    ANM: [
        'staff:workspace',
        'patient:register',
        'patient:vitals',
        'patient:view',
        'referral:view',
        'referral:create',
        'referral:comment',
        'capacity:view',
        'followup:manage',
        'teleconsult:use',
        'dashboard:my',
    ],

    // PHC. Receives what the Sub Centre sends, answers it, treats, escalates to
    // CHC/DH. Runs the PHC's own OPD, queue, stock and lab. Discharge covers a
    // patient admitted to the PHC's own beds. No Command Center, no audit.
    MO: [
        'staff:workspace',
        'patient:register',
        'patient:vitals',
        'patient:view',
        'treatment:notes',
        'referral:view',
        'referral:create',
        'referral:receive',
        'referral:acknowledge',
        'referral:accept_reject',
        'referral:escalate',
        'referral:arrival',
        'referral:discharge',
        'referral:comment',
        'capacity:view',
        'resources:view',
        'queue:manage',
        'appointments:manage',
        'stock:manage',
        'diagnostics:manage',
        'teleconsult:use',
        'followup:manage',
    ],

    // CHC / District Hospital bed manager. Owns the resources an acceptance is
    // based on, and so answers incoming referrals and books arrivals. Command
    // Center is read-only and scoped to the own facility (see app/dashboard).
    HOSPITAL_ADMIN: [
        'staff:workspace',
        'patient:view',
        'referral:view',
        'referral:receive',
        'referral:acknowledge',
        'referral:accept_reject',
        'referral:arrival',
        'referral:comment',
        'capacity:view',
        'resources:view',
        'capacity:manage',
        'maintenance:manage',
        'command_center:view',
    ],

    // CHC / District Hospital clinician. Sees patients once accepted, writes
    // treatment notes, discharges. Not a bed manager; no accept/reject.
    // Holds no referral:receive, so unanswered referrals stay off the list.
    SPECIALIST: [
        'staff:workspace',
        'patient:view',
        'treatment:notes',
        'referral:view',
        'referral:discharge',
        'referral:comment',
        'resources:view',
        'diagnostics:manage',
        'teleconsult:use',
    ],

    // District. Full read across every facility and the oversight surfaces.
    // Holds no clinical action: the DHO watches and is alerted on escalation;
    // a district officer quietly answering a CHC's referral would place a
    // decision outside the facility that has to honour it.
    DHO: [
        'staff:workspace',
        'patient:view',
        'referral:view',
        'referral:receive',
        'referral:comment',
        'capacity:view',
        'resources:view',
        'command_center:view',
        'analytics:view',
        'audit:view',
        'data:inspect',
        'demo:simulate',
    ],

    // System. Manages users, roles and facilities, and can read everything to
    // do so. Deliberately holds no clinical action — a system administrator
    // accepting a patient would be an audit finding, not a feature.
    SUPER_ADMIN: [
        'staff:workspace',
        'patient:view',
        'referral:view',
        'referral:receive',
        'capacity:view',
        'resources:view',
        'capacity:manage',
        'maintenance:manage',
        'command_center:view',
        'analytics:view',
        'audit:view',
        'data:inspect',
        'admin:users',
        'admin:roles',
        'admin:facilities',
        'demo:simulate',
    ],
};

/**
 * Roles that see every facility's data. Everyone else is confined to the
 * facility on their session. This is the whole scoping rule — there is no
 * second list granting exceptions somewhere else.
 */
export const DISTRICT_WIDE_ROLES: readonly StaffRole[] = ['DHO', 'SUPER_ADMIN'];

export const ROLE_LABELS: Record<StaffRole, string> = {
    ANM: 'ANM / Nurse',
    MO: 'Medical Officer',
    HOSPITAL_ADMIN: 'Hospital Admin / Bed Manager',
    SPECIALIST: 'Specialist Doctor',
    DHO: 'District Health Officer',
    SUPER_ADMIN: 'Super Admin',
};

/** Where each role is posted — used to offer only sensible postings at login. */
export const ROLE_FACILITY_TIERS: Record<StaffRole, readonly FacilityType[]> = {
    ANM: ['SC'],
    MO: ['PHC'],
    HOSPITAL_ADMIN: ['CHC', 'SDH', 'DH'],
    SPECIALIST: ['CHC', 'SDH', 'DH'],
    DHO: [],          // district level — no single facility
    SUPER_ADMIN: [],  // system — no facility
};

/** The posting label for roles that have no facility. */
export const ROLE_POSTING_LABEL: Partial<Record<StaffRole, string>> = {
    DHO: 'District Health Office',
    SUPER_ADMIN: 'System Administration',
};

/**
 * Route → the permission needed to open it.
 *
 * Only guarded routes appear. Everything absent is public: the citizen half of
 * the portal (services, facility directory, emergency SOS, policies, citizen
 * login) must stay reachable without a staff session, so a denylist is the
 * safe shape — an allowlist locks out the public the first time someone adds a
 * page and forgets to register it.
 *
 * Matching is exact first, then longest prefix on a path boundary. A key
 * ending in '/' guards only what is *beneath* it, which is how /dashboard (the
 * Command Center) and /dashboard/<id> (one patient's record) differ.
 */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
    // Oversight
    '/dashboard': 'command_center:view',
    '/audit': 'audit:view',
    '/data': 'data:inspect',

    // Patient care
    '/dashboard/': 'patient:view',
    '/record': 'patient:view',
    '/opd': 'patient:register',
    '/triage': 'patient:vitals',
    '/my-dashboard': 'dashboard:my',

    // Referrals
    '/referrals': 'referral:view',
    '/incoming': 'referral:receive',

    // Facility resources
    '/facility-resources': 'resources:view',

    // Facility operations
    '/queue': 'queue:manage',
    '/appointments': 'appointments:manage',
    '/medicine': 'stock:manage',
    '/diagnostics': 'diagnostics:manage',
    '/teleconsult': 'teleconsult:use',
    '/followup': 'followup:manage',

    // The staff workspace and its redirect stubs
    '/staff': 'staff:workspace',

    // System
    '/admin': 'admin:users',
    '/demo': 'demo:simulate',
};

/**
 * Paths open even when a prefix rule above would cover them. '/staff' guards
 * the workspace and '/staff/login' sits inside it; without this the sign-in
 * page would demand a session. Exact matches only, so one hole cannot open a
 * subtree.
 */
export const PUBLIC_ROUTES: readonly string[] = ['/staff/login', '/login', '/403'];

/** Where each role lands after signing in. */
export const ROLE_HOME: Record<StaffRole, string> = {
    ANM: '/my-dashboard',
    MO: '/referrals',
    HOSPITAL_ADMIN: '/facility-resources',
    SPECIALIST: '/referrals',
    DHO: '/dashboard',
    SUPER_ADMIN: '/admin',
};

export function isStaffRole(value: unknown): value is StaffRole {
    return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}

/** Does this role hold this capability at all, ignoring whose data it is? */
export function can(role: StaffRole | null | undefined, permission: Permission): boolean {
    if (!role) return false;
    const granted = ROLE_PERMISSIONS[role];
    return Boolean(granted && granted.includes(permission));
}

/** May this role read other facilities' data, or only its own? */
export function isDistrictWide(role: StaffRole | null | undefined): boolean {
    return Boolean(role && DISTRICT_WIDE_ROLES.includes(role));
}

/**
 * Trailing slashes, query strings and fragments are noise for matching. The
 * static export serves '/incoming' and '/incoming/' as one page, so they must
 * gate identically — otherwise the trailing slash is an open door.
 */
export function normalisePath(pathname: string): string {
    const bare = pathname.split(/[?#]/)[0] || '/';
    return bare.length > 1 && bare.endsWith('/') ? bare.slice(0, -1) : bare;
}

/** The permission a path requires, or null if the path is public. */
export function requiredPermissionForRoute(pathname: string): Permission | null {
    const path = normalisePath(pathname);
    if (PUBLIC_ROUTES.includes(path)) return null;

    const exact = ROUTE_PERMISSIONS[path];
    if (exact) return exact;

    let best = '';
    let bestPermission: Permission | null = null;
    for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
        // Match on a path boundary: '/record' must not guard '/records-archive'.
        const matches = route.endsWith('/')
            ? path.startsWith(route)
            : path.startsWith(`${route}/`);
        if (matches && route.length > best.length) {
            best = route;
            bestPermission = permission;
        }
    }
    return bestPermission;
}

/** May this role open this path? Public paths are open to everyone. */
export function canAccessRoute(role: StaffRole | null | undefined, pathname: string): boolean {
    const required = requiredPermissionForRoute(pathname);
    return required === null || can(role, required);
}

/**
 * Keep only the rows this session may see. District-wide roles get everything;
 * everyone else gets rows touching their facility. `facilityIdsOf` returns
 * every facility a row belongs to, because a referral belongs to two — the
 * sender must keep seeing it after the receiver has it, or "view own
 * referrals and their status" stops working the moment a referral succeeds.
 */
export function scopeToFacility<T>(
    rows: readonly T[],
    session: { role: StaffRole | null; facilityId: string | null } | null,
    facilityIdsOf: (row: T) => readonly (string | null | undefined)[]
): T[] {
    if (!session?.role) return [];
    if (isDistrictWide(session.role)) return [...rows];
    const own = session.facilityId;
    // No facility on a facility-bound session means no basis for any row.
    // Showing everything would hand a half-configured session district reach.
    if (!own) return [];
    return rows.filter(row => facilityIdsOf(row).some(id => id === own));
}
