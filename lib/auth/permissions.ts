/**
 * Who may do what — the single place roles are defined.
 *
 * Every gate in the app reads this file: the sidebar decides what to render
 * from it, the route guard decides what to admit from it, and the referral
 * actions decide which buttons exist from it. Editing a role here changes the
 * app everywhere, which is the point — a permission spelled out inline in a
 * component is a permission nobody can audit, and in a referral system the
 * question "who was allowed to reject this patient?" has to have one answer.
 *
 * WHAT THIS IS NOT
 * ----------------
 * This is not security. The session is mock auth held in the browser, the app
 * is a static export with no server to enforce anything, and anyone willing to
 * open devtools can set any role they like. What it *is* is a correct model of
 * the hierarchy: it keeps an ANM from being shown a district-wide bed board she
 * has no business acting on, and it keeps the screens honest about whose data
 * is whose. Real enforcement belongs on the district service, which is why
 * every permission below is named after a capability rather than a screen —
 * the same names transfer to a server-side check unchanged.
 *
 * FACILITY SCOPING
 * ----------------
 * Permissions answer "may this cadre do this at all". Scoping answers "to whose
 * patients" — and the two are independent. A Medical Officer may accept
 * referrals, but only ones addressed to their own PHC. Only the District Health
 * Officer and Super Admin see across facilities; see DISTRICT_WIDE_ROLES.
 */

/**
 * Cadres, as the public health hierarchy actually staffs them.
 *
 * HOSPITAL_ADMIN and SUPER_ADMIN are new; the rest predate RBAC and keep their
 * identifiers so existing sessions, audit rows and referral records stay valid.
 */
export type StaffRole =
    | 'ASHA'
    | 'ANM'
    | 'MO'
    | 'SPECIALIST'
    | 'HOSPITAL_ADMIN'
    | 'PHARMACIST'
    | 'LAB_TECH'
    | 'DHO'
    | 'SUPER_ADMIN';

/**
 * Capabilities, named after the act rather than the page that hosts it.
 *
 * "referral:accept_reject" survives the screen being redesigned, moved or split
 * in two; "can_see_incoming_page" would not.
 */
export type Permission =
    // Patient care
    | 'patient:register'
    | 'patient:vitals'
    | 'patient:view'
    | 'treatment:notes'
    // Referral lifecycle
    | 'referral:create'
    | 'referral:receive'
    | 'referral:acknowledge'
    | 'referral:accept_reject'
    | 'referral:escalate'
    | 'referral:mark_arrival'
    | 'referral:discharge'
    // Facility resources
    | 'capacity:manage'
    | 'maintenance:manage'
    // Oversight
    | 'command_center:view'
    | 'analytics:view'
    | 'audit:view'
    // System administration
    | 'admin:users'
    | 'admin:facilities'
    // Personal workspace
    | 'dashboard:my';

/**
 * The permission grant per cadre, mirroring the service rules one-for-one.
 *
 * ASHA and ANM are listed separately although they currently grant the same
 * set: they are different cadres with different scopes of practice, and
 * collapsing them into one entry means the day ANM gains a capability, ASHA
 * silently gains it too.
 */
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
    // Sub Centre. Registers patients, records vitals, starts referrals and
    // follows what happened to them. Explicitly cannot accept or reject — a
    // referral is answered by the facility receiving it, never the one sending.
    ASHA: [
        'patient:register',
        'patient:vitals',
        'patient:view',
        'referral:create',
        'dashboard:my',
    ],
    ANM: [
        'patient:register',
        'patient:vitals',
        'patient:view',
        'referral:create',
        'dashboard:my',
    ],

    // PHC. Receives what the Sub Centre sends, answers it, treats, and escalates
    // upward to CHC/DH when the case outgrows the PHC.
    MO: [
        'patient:register',
        'patient:vitals',
        'patient:view',
        'treatment:notes',
        'referral:create',
        'referral:receive',
        'referral:acknowledge',
        'referral:accept_reject',
        'referral:escalate',
        'referral:mark_arrival',
        'audit:view',
        'dashboard:my',
    ],

    // CHC / District Hospital bed manager. Owns the resources an acceptance is
    // actually based on, and therefore answers incoming referrals. Gets
    // command_center:view, but scoping keeps it to their own facility — see
    // DISTRICT_WIDE_ROLES.
    HOSPITAL_ADMIN: [
        'patient:view',
        'referral:receive',
        'referral:accept_reject',
        'referral:mark_arrival',
        'capacity:manage',
        'maintenance:manage',
        'command_center:view',
        'analytics:view',
    ],

    // CHC / District Hospital clinician. Picks up patients once accepted,
    // writes treatment notes and discharges. Not a bed manager: no capacity
    // rights, and no accept/reject.
    SPECIALIST: [
        'patient:view',
        'treatment:notes',
        'referral:receive',
        'referral:discharge',
        'audit:view',
    ],

    // Support cadres. Present in the hierarchy and in the login screen, but
    // outside the referral decision chain entirely.
    PHARMACIST: ['patient:view'],
    LAB_TECH: ['patient:view'],

    // District level. Full read across every facility, plus the oversight
    // surfaces. Deliberately holds no accept/reject: the DHO watches and
    // escalates, and a district officer quietly answering a CHC's referrals
    // would put a decision outside the facility that has to honour it.
    DHO: [
        'patient:view',
        'referral:receive',
        'command_center:view',
        'analytics:view',
        'audit:view',
    ],

    // System administration. Everything, because the role exists to repair the
    // other roles.
    SUPER_ADMIN: [
        'patient:register',
        'patient:vitals',
        'patient:view',
        'treatment:notes',
        'referral:create',
        'referral:receive',
        'referral:acknowledge',
        'referral:accept_reject',
        'referral:escalate',
        'referral:mark_arrival',
        'referral:discharge',
        'capacity:manage',
        'maintenance:manage',
        'command_center:view',
        'analytics:view',
        'audit:view',
        'admin:users',
        'admin:facilities',
        'dashboard:my',
    ],
};

/**
 * Roles that see every facility's data.
 *
 * Everyone else is confined to the facility on their session. This is the whole
 * of the scoping rule — there is no second list somewhere granting exceptions,
 * because an exception nobody can find is how a Sub Centre ends up reading
 * another district's patients.
 */
export const DISTRICT_WIDE_ROLES: readonly StaffRole[] = ['DHO', 'SUPER_ADMIN'];

/** Human-readable cadre names, for login, headers and audit rendering. */
export const ROLE_LABELS: Record<StaffRole, string> = {
    ASHA: 'ASHA / Frontline Health Worker',
    ANM: 'ANM / Nurse (Sub Centre)',
    MO: 'Medical Officer (PHC)',
    SPECIALIST: 'Specialist Doctor (CHC / DH)',
    HOSPITAL_ADMIN: 'Hospital Admin / Bed Manager (CHC / DH)',
    PHARMACIST: 'Pharmacist',
    LAB_TECH: 'Lab Technician',
    DHO: 'District Health Officer',
    SUPER_ADMIN: 'Super Admin (System)',
};

/**
 * The tier each cadre is posted at, used to default the facility picker at
 * login so a Medical Officer is not offered a Sub Centre as their posting.
 * Empty means the cadre may be posted anywhere.
 */
export const ROLE_FACILITY_TIERS: Record<StaffRole, readonly string[]> = {
    ASHA: ['SC'],
    ANM: ['SC'],
    MO: ['PHC', 'CHC'],
    SPECIALIST: ['CHC', 'SDH', 'DH'],
    HOSPITAL_ADMIN: ['CHC', 'SDH', 'DH'],
    PHARMACIST: ['PHC', 'CHC', 'SDH', 'DH'],
    LAB_TECH: ['PHC', 'CHC', 'SDH', 'DH'],
    DHO: [],
    SUPER_ADMIN: [],
};

/**
 * Route → the permission needed to open it.
 *
 * Only guarded routes appear. Everything absent is public — the citizen-facing
 * half of the portal (services, policies, the patient's own login) must stay
 * reachable without a staff session, so an allowlist would lock out the public
 * the first time someone added a page and forgot to register it.
 *
 * Matching is exact first, then longest-prefix; see requiredPermissionForRoute.
 * That ordering matters for /dashboard, where the index is the district command
 * view but /dashboard/<id> is a single patient's record.
 */
export const ROUTE_PERMISSIONS: Record<string, Permission> = {
    // Oversight
    '/command-center': 'command_center:view',
    '/dashboard': 'command_center:view',
    '/audit': 'audit:view',

    // Patient care
    '/dashboard/': 'patient:view',
    '/record': 'patient:register',
    '/opd': 'patient:register',
    '/triage': 'patient:vitals',
    '/staff/triage': 'patient:vitals',

    // Referrals
    '/referrals': 'referral:create',
    '/incoming': 'referral:receive',
    '/staff/referrals': 'referral:receive',

    // Facility resources
    '/facility-resources': 'capacity:manage',
    '/staff/stock': 'capacity:manage',

    // Personal workspace
    '/my-dashboard': 'dashboard:my',

    // The staff workspace as a whole. Every cadre holds patient:view, so this
    // reads as "any signed-in cadre" while still being a real capability rather
    // than a second, parallel notion of "logged in" that could drift from the
    // permission table.
    '/staff': 'patient:view',

    // System administration
    '/admin/users': 'admin:users',
    '/admin/facilities': 'admin:facilities',
};

/**
 * Paths that stay open even when a prefix rule above would otherwise cover them.
 *
 * '/staff' guards the whole staff workspace, and '/staff/login' sits inside it —
 * without this exemption the sign-in page would demand a session to reach,
 * which locks every cadre out of the app permanently. Exemptions are exact
 * matches only, so carving one hole cannot accidentally open a subtree.
 */
export const PUBLIC_ROUTES: readonly string[] = ['/staff/login', '/login', '/403'];

/** Does this cadre hold this capability at all, ignoring whose data it is? */
export function can(role: StaffRole | null | undefined, permission: Permission): boolean {
    if (!role) return false;
    const granted = ROLE_PERMISSIONS[role];
    if (!granted) return false;
    return granted.includes(permission);
}

/** Does this cadre hold every one of these capabilities? */
export function canAll(role: StaffRole | null | undefined, permissions: readonly Permission[]): boolean {
    return permissions.every(p => can(role, p));
}

/** Does this cadre hold at least one of these capabilities? */
export function canAny(role: StaffRole | null | undefined, permissions: readonly Permission[]): boolean {
    return permissions.some(p => can(role, p));
}

/** May this role read other facilities' data, or only its own? */
export function isDistrictWide(role: StaffRole | null | undefined): boolean {
    if (!role) return false;
    return DISTRICT_WIDE_ROLES.includes(role);
}

/**
 * The permission a path requires, or null if the path is public.
 *
 * Exact matches win over prefixes so a specific rule can carve an exception out
 * of a general one — '/dashboard' is the command centre, while '/dashboard/'
 * covers the patient records beneath it. Among prefixes the longest wins, so
 * '/staff/referrals' is not swallowed by a future '/staff' rule.
 */
export function requiredPermissionForRoute(pathname: string): Permission | null {
    const path = normalisePath(pathname);

    if (PUBLIC_ROUTES.includes(path)) return null;

    const exact = ROUTE_PERMISSIONS[path];
    if (exact) return exact;

    let bestPrefix = '';
    let bestPermission: Permission | null = null;
    for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
        // A prefix rule must match on a path boundary. Without this, '/record'
        // would also guard '/records-archive', which is a different page.
        const isPrefixMatch = route.endsWith('/')
            ? path.startsWith(route)
            : path === route || path.startsWith(`${route}/`);
        if (isPrefixMatch && route.length > bestPrefix.length) {
            bestPrefix = route;
            bestPermission = permission;
        }
    }
    return bestPermission;
}

/** May this role open this path? Public paths are open to everyone, signed in or not. */
export function canAccessRoute(role: StaffRole | null | undefined, pathname: string): boolean {
    const required = requiredPermissionForRoute(pathname);
    if (!required) return true;
    return can(role, required);
}

/**
 * Trailing slashes and query/hash fragments are noise for matching purposes.
 * Next's static export serves '/incoming' and '/incoming/' as the same page, so
 * they must gate identically — otherwise the trailing slash is an open door.
 */
function normalisePath(pathname: string): string {
    const withoutQuery = pathname.split(/[?#]/)[0];
    if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
        return withoutQuery.slice(0, -1);
    }
    return withoutQuery;
}

/**
 * Keep only the rows this session is entitled to see.
 *
 * District-wide roles get everything; everyone else gets their own facility.
 * `facilityIdsOf` returns every facility a row touches, because a referral
 * belongs to two of them — the Sub Centre that sent it must keep seeing it
 * after it arrives at the PHC, or "view own referrals and their status" stops
 * working the moment the referral succeeds.
 */
export function scopeToFacility<T>(
    rows: readonly T[],
    session: { role: StaffRole | null; facilityId: string | null },
    facilityIdsOf: (row: T) => readonly (string | undefined)[]
): T[] {
    if (isDistrictWide(session.role)) return [...rows];
    const own = session.facilityId;
    // No facility on the session means no basis to claim any row. Showing
    // everything here would hand a half-configured session district-wide
    // reach; showing nothing is visibly wrong and gets fixed.
    if (!own) return [];
    return rows.filter(row => facilityIdsOf(row).some(id => id === own));
}
