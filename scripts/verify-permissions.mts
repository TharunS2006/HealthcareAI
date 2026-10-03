/**
 * Role-based access regression check — `npm run verify:permissions`
 *
 * Every gate in the app reads lib/auth/permissions.ts, so this pins the file
 * against the spec's role table and against the ways a path-matcher leaks:
 *
 *   1. THE TABLE     each role can do exactly its row — and, as importantly,
 *                    cannot do the rows above and below it.
 *   2. ROUTES        Command Center only for DHO / Super Admin (+ read-only
 *                    Hospital Admin); direct URLs gated; public pages public;
 *                    trailing slashes and look-alike paths do not slip through.
 *   3. SCOPING       only DHO and Super Admin read across facilities.
 *   4. CONSISTENCY   no route nobody can open, every role can reach its home,
 *                    every seeded user is posted at a facility of their tier.
 */

const P = await import('../lib/auth/permissions');
const { SEED_USERS } = await import('../lib/auth/users');
const { FACILITY_NETWORK } = await import('../lib/data/facilities');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const yes = (role: any, perms: string[]) => perms.every(p => P.can(role, p as any));
const no = (role: any, perms: string[]) => perms.every(p => !P.can(role, p as any));
const CLINICAL = ['patient:register', 'referral:accept_reject', 'referral:acknowledge', 'referral:arrival', 'referral:discharge', 'treatment:notes', 'referral:create'];

// ---------------------------------------------------------------------------
console.log('\n1. THE TABLE');
// ---------------------------------------------------------------------------
check('ANM: register, vitals, create/forward, view own', yes('ANM', ['patient:register', 'patient:vitals', 'referral:create', 'referral:view']));
check('ANM: cannot receive, answer, see Command Center or audit', no('ANM', ['referral:receive', 'referral:accept_reject', 'command_center:view', 'audit:view', 'capacity:manage']));
check('MO: receive, acknowledge, accept/reject, treat, escalate', yes('MO', ['referral:receive', 'referral:acknowledge', 'referral:accept_reject', 'treatment:notes', 'referral:escalate']));
check('MO: no Command Center, no audit, no bed management', no('MO', ['command_center:view', 'audit:view', 'capacity:manage', 'maintenance:manage']));
check('Hospital Admin: beds, equipment, maintenance, accept/decline', yes('HOSPITAL_ADMIN', ['capacity:manage', 'maintenance:manage', 'referral:accept_reject', 'referral:arrival']));
check('Hospital Admin: does not raise referrals, treat or discharge', no('HOSPITAL_ADMIN', ['referral:create', 'treatment:notes', 'referral:discharge']));
check('Specialist: notes and discharge', yes('SPECIALIST', ['treatment:notes', 'referral:discharge', 'referral:view']));
check('Specialist: cannot accept, cannot see unanswered referrals', no('SPECIALIST', ['referral:accept_reject', 'referral:receive', 'capacity:manage']));
check('DHO: full read, Command Center, analytics, audit', yes('DHO', ['patient:view', 'referral:view', 'command_center:view', 'analytics:view', 'audit:view']));
check('DHO: no clinical action', no('DHO', CLINICAL));
check('Super Admin: users, roles, facilities', yes('SUPER_ADMIN', ['admin:users', 'admin:roles', 'admin:facilities']));
check('Super Admin: no clinical action', no('SUPER_ADMIN', CLINICAL));
check('only Super Admin administers', P.STAFF_ROLES.filter(r => P.can(r, 'admin:users')).join() === 'SUPER_ADMIN');
check('a missing role holds nothing', P.can(null, 'patient:view') === false && P.can(undefined, 'staff:workspace') === false);

// ---------------------------------------------------------------------------
console.log('\n2. ROUTES');
// ---------------------------------------------------------------------------
const who = (path: string) => P.STAFF_ROLES.filter(r => P.canAccessRoute(r, path)).join(',');
check('/dashboard (Command Center): DHO, Super Admin, and Hospital Admin read-only', who('/dashboard') === 'HOSPITAL_ADMIN,DHO,SUPER_ADMIN', who('/dashboard'));
check('ANM and MO get 403 on /dashboard by direct URL', !P.canAccessRoute('ANM', '/dashboard') && !P.canAccessRoute('MO', '/dashboard'));
check('signed-out visitors get 403 on /dashboard', !P.canAccessRoute(null, '/dashboard'));
check('/dashboard/<id> is a patient record, not the Command Center', P.requiredPermissionForRoute('/dashboard/p-gad-1001') === 'patient:view');
check('/my-dashboard is the ANM\'s', who('/my-dashboard') === 'ANM');
check('/facility-resources opens for bed managers and readers, not ANMs', P.canAccessRoute('HOSPITAL_ADMIN', '/facility-resources') && !P.canAccessRoute('ANM', '/facility-resources'));
check('/admin is Super Admin only', who('/admin') === 'SUPER_ADMIN' && who('/admin/users') === 'SUPER_ADMIN');
check('/audit is DHO and Super Admin only', who('/audit') === 'DHO,SUPER_ADMIN');
check('/incoming needs referral:receive', who('/incoming') === 'MO,HOSPITAL_ADMIN,DHO,SUPER_ADMIN');
check('trailing slash gates the same', P.requiredPermissionForRoute('/dashboard/') === P.requiredPermissionForRoute('/dashboard'));
check('query and hash do not change the gate', P.requiredPermissionForRoute('/audit?x=1#y') === 'audit:view');
check('/record guards /record but not /records-archive', P.requiredPermissionForRoute('/record') === 'patient:view' && P.requiredPermissionForRoute('/records-archive') === null);
check('staff redirect stubs are guarded', P.requiredPermissionForRoute('/staff/referrals') === 'staff:workspace');
check('staff sign-in is public', P.requiredPermissionForRoute('/staff/login') === null);
check('citizen pages stay public', ['/', '/login', '/facilities', '/services-info', '/emergency', '/privacy', '/403'].every(p => P.requiredPermissionForRoute(p) === null));
check('the simulation page is gated', P.requiredPermissionForRoute('/demo/simulation') === 'demo:simulate');

// ---------------------------------------------------------------------------
console.log('\n3. SCOPING');
// ---------------------------------------------------------------------------
const rows = [{ f: ['sc-kothi', 'phc-bhamragad'] }, { f: ['phc-perimili', 'dh-district'] }];
const scope = (role: any, facilityId: string | null) => P.scopeToFacility(rows, { role, facilityId }, r => r.f).length;
check('an ANM sees rows touching her own facility only', scope('ANM', 'sc-kothi') === 1);
check('a PHC sees both the rows it sends and receives', scope('MO', 'phc-bhamragad') === 1 && scope('MO', 'phc-perimili') === 1);
check('DHO and Super Admin see everything', scope('DHO', null) === 2 && scope('SUPER_ADMIN', null) === 2);
check('a facility-bound role with no facility sees nothing, not everything', scope('MO', null) === 0);
check('no session sees nothing', P.scopeToFacility(rows, null, r => r.f).length === 0);
check('only DHO and Super Admin are district-wide', P.STAFF_ROLES.filter(r => P.isDistrictWide(r)).join() === 'DHO,SUPER_ADMIN');

// ---------------------------------------------------------------------------
console.log('\n4. CONSISTENCY');
// ---------------------------------------------------------------------------
const dead = Object.entries(P.ROUTE_PERMISSIONS).filter(([, perm]) => !P.STAFF_ROLES.some(r => P.can(r, perm)));
check('every guarded route is open to at least one role', dead.length === 0, dead.map(([r]) => r).join(', '));
check('every role holds staff:workspace', P.STAFF_ROLES.every(r => P.can(r, 'staff:workspace')));
check('every role can open its landing page', P.STAFF_ROLES.every(r => P.canAccessRoute(r, P.ROLE_HOME[r])),
    P.STAFF_ROLES.filter(r => !P.canAccessRoute(r, P.ROLE_HOME[r])).join());
check('there is a seeded user for every role', P.STAFF_ROLES.every(r => SEED_USERS.some(u => u.role === r)));
const misposted = SEED_USERS.filter(u => {
    const tiers = P.ROLE_FACILITY_TIERS[u.role];
    if (tiers.length === 0) return u.facilityId !== null;
    const f = FACILITY_NETWORK.find(x => x.id === u.facilityId);
    return !f || !tiers.includes(f.type);
});
check('every seeded user is posted at a facility of their tier', misposted.length === 0, misposted.map(u => u.id).join());
check('seeded user ids are unique', new Set(SEED_USERS.map(u => u.id)).size === SEED_USERS.length);

// The district service reads a JSON export of this table; it must not drift.
const { readFileSync } = await import('node:fs');
const exported = JSON.parse(readFileSync('backend/app/permissions.json', 'utf8'));
const current = Object.fromEntries(P.STAFF_ROLES.map(r => [r, [...P.ROLE_PERMISSIONS[r]].sort()]));
check('backend/app/permissions.json matches lib/auth/permissions.ts (else run npm run export:permissions)',
    JSON.stringify(exported.roles) === JSON.stringify(current) &&
    JSON.stringify(exported.district_wide) === JSON.stringify([...P.DISTRICT_WIDE_ROLES]));

console.log(failures === 0 ? '\nAll permission checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
