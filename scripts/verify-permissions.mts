/**
 * Role-based access control — `npm run verify:permissions`
 *
 * lib/auth/permissions.ts is the one place that answers "who may do what, to
 * whose patients". Nothing about it is visible in the browser until it is
 * already wrong: a sidebar that silently grows an extra module, a route guard
 * that admits a cadre it should refuse, a facility filter that returns every
 * district's referrals — all three render perfectly.
 *
 * So the properties asserted below are the ones whose failure is invisible:
 *
 *   - the hierarchy rules that make the referral chain safe (the facility that
 *     sends a referral cannot answer it; the district officer does not answer
 *     it either)
 *   - path matching, where a trailing slash or a shared prefix is the whole
 *     difference between a guarded page and an open one
 *   - facility scoping, where "no facility on the session" must mean no rows
 *     rather than every row
 *
 * Run after editing roles, adding a route, or changing the scoping helper.
 */

const {
    ROLE_PERMISSIONS,
    ROLE_LABELS,
    ROLE_FACILITY_TIERS,
    ROUTE_PERMISSIONS,
    PUBLIC_ROUTES,
    DISTRICT_WIDE_ROLES,
    can,
    canAll,
    canAny,
    isDistrictWide,
    requiredPermissionForRoute,
    canAccessRoute,
    scopeToFacility,
} = await import('../lib/auth/permissions');

type StaffRole = keyof typeof ROLE_PERMISSIONS;

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as StaffRole[];

const failures: string[] = [];
const pass = (label: string) => console.log(`  PASS  ${label}`);
const fail = (label: string, detail: string) => {
    console.log(`  FAIL  ${label}\n        ${detail}`);
    failures.push(label);
};
const check = (label: string, ok: boolean, detail: string) => (ok ? pass(label) : fail(label, detail));

// ── 1. The tables cover every cadre ──────────────────────────────────────────
// A role present in one table and missing from another is a role that can be
// signed in as but renders as `undefined` in a header, or one that holds
// permissions nobody can reach.
console.log('\nEvery cadre appears in every table:');
{
    for (const table of [
        ['ROLE_LABELS', ROLE_LABELS],
        ['ROLE_FACILITY_TIERS', ROLE_FACILITY_TIERS],
    ] as const) {
        const [name, obj] = table;
        const missing = ALL_ROLES.filter(r => (obj as Record<string, unknown>)[r] === undefined);
        check(`${name} covers all ${ALL_ROLES.length} cadres`, missing.length === 0,
            `missing: ${missing.join(', ')}`);
    }
    const unlabelled = ALL_ROLES.filter(r => !ROLE_LABELS[r] || ROLE_LABELS[r].trim() === '');
    check('no cadre has a blank label', unlabelled.length === 0,
        `blank: ${unlabelled.join(', ')} — the login picker would show an empty option`);
}

// ── 2. No permission is granted to nobody, no route needs a permission nobody has ──
console.log('\nPermissions and routes reconcile:');
{
    const granted = new Set(ALL_ROLES.flatMap(r => [...ROLE_PERMISSIONS[r]]));
    const routePerms = [...new Set(Object.values(ROUTE_PERMISSIONS))];
    const unreachable = routePerms.filter(p => !granted.has(p));
    check('every guarded route is reachable by at least one cadre', unreachable.length === 0,
        `no role holds: ${unreachable.join(', ')} — those pages are dead to everyone`);

    const superSet = new Set(ROLE_PERMISSIONS.SUPER_ADMIN);
    const beyondSuper = [...granted].filter(p => !superSet.has(p));
    check('SUPER_ADMIN holds every permission any cadre holds', beyondSuper.length === 0,
        `granted elsewhere but not to SUPER_ADMIN: ${beyondSuper.join(', ')} — the role exists to repair the others`);
}

// ── 3. Referral hierarchy rules ──────────────────────────────────────────────
// These are clinical-governance rules, not UI preferences. A Sub Centre that
// could accept its own referral would let a facility mark a patient received by
// a hospital that never saw them.
console.log('\nThe referral chain holds:');
{
    check('a Sub Centre cadre cannot accept or reject a referral',
        !can('ANM', 'referral:accept_reject') && !can('ASHA', 'referral:accept_reject'),
        'the facility sending a referral would be able to answer it on the receiver\'s behalf');

    check('a Sub Centre cadre can still create one',
        can('ANM', 'referral:create') && can('ASHA', 'referral:create'),
        'the field cadre could not start a referral at all');

    check('the District Health Officer does not accept or reject',
        !can('DHO', 'referral:accept_reject'),
        'a district officer answering a CHC\'s referral puts the decision outside the facility that must honour it');

    check('the District Health Officer can still watch referrals',
        can('DHO', 'referral:receive') && can('DHO', 'command_center:view'),
        'oversight without visibility is not oversight');

    check('only the receiving tiers answer referrals',
        canAll('MO', ['referral:receive', 'referral:acknowledge', 'referral:accept_reject'])
        && canAll('HOSPITAL_ADMIN', ['referral:receive', 'referral:accept_reject']),
        'the PHC Medical Officer and the CHC/DH bed manager must both be able to answer');

    check('a specialist treats but does not manage beds',
        can('SPECIALIST', 'referral:discharge')
        && !canAny('SPECIALIST', ['capacity:manage', 'referral:accept_reject']),
        'a clinician deciding bed availability bypasses the bed manager who owns the count');

    check('support cadres stay outside the referral decision chain',
        !canAny('PHARMACIST', ['referral:create', 'referral:accept_reject'])
        && !canAny('LAB_TECH', ['referral:create', 'referral:accept_reject']),
        'pharmacy and lab cadres are not in the referral chain');
}

// ── 4. Command centre restriction (spec: direct URL access must be refused) ──
console.log('\nThe command centre is restricted:');
{
    const forbidden: StaffRole[] = ['ASHA', 'ANM', 'MO', 'PHARMACIST', 'LAB_TECH', 'SPECIALIST'];
    for (const role of forbidden) {
        check(`${role} cannot open /command-center`, !canAccessRoute(role, '/command-center'),
            'a field or PHC cadre would see district-wide bed and escalation data');
        check(`${role} cannot open /dashboard`, !canAccessRoute(role, '/dashboard'),
            'the district command view is the same screen under its older path');
    }
    for (const role of ['DHO', 'SUPER_ADMIN', 'HOSPITAL_ADMIN'] as StaffRole[]) {
        check(`${role} can open /command-center`, canAccessRoute(role, '/command-center'),
            'the cadre that runs the district cannot see it');
    }
    check('a signed-out visitor cannot open /command-center', !canAccessRoute(null, '/command-center'),
        'the district board would be public');

    check('the nurse dashboard is open to the field cadre and not to the bed manager',
        canAccessRoute('ANM', '/my-dashboard') && !canAccessRoute('HOSPITAL_ADMIN', '/my-dashboard'),
        'My Dashboard is the simple view offered to nurses instead of the command centre');
}

// ── 5. Facility scoping is separate from permission ──────────────────────────
console.log('\nOnly district cadres read across facilities:');
{
    for (const role of ALL_ROLES) {
        const expected = DISTRICT_WIDE_ROLES.includes(role);
        check(`${role} district-wide = ${expected}`, isDistrictWide(role) === expected,
            'scoping and the DISTRICT_WIDE_ROLES list disagree');
    }
    check('a signed-out visitor is not district-wide', !isDistrictWide(null),
        'null role must never be treated as privileged');
}

// ── 6. Path matching ─────────────────────────────────────────────────────────
// Every case here is one a real browser produces: a trailing slash from a
// static export, a query string from the route guard's own redirect, a path
// that merely starts with the same letters as a guarded one.
console.log('\nPaths match the way a browser produces them:');
{
    const cases: [string, string | null, string][] = [
        ['/command-center', 'command_center:view', 'exact match'],
        ['/command-center/', 'command_center:view', 'trailing slash must gate identically — a static export serves both'],
        ['/incoming?ref=REF-1', 'referral:receive', 'a query string must not open the door'],
        ['/audit#row-3', 'audit:view', 'a hash fragment must not open the door'],
        ['/dashboard', 'command_center:view', 'the dashboard index is the district command view'],
        ['/dashboard/PT-2024-0912', 'patient:view', 'a patient record beneath it is a care view, not an oversight view'],
        ['/records-archive', null, 'must not be swallowed by the /record rule'],
        ['/record', 'patient:register', 'the registration page itself is guarded'],
        ['/staff', 'patient:view', 'the staff workspace requires a cadre'],
        ['/staff/triage', 'patient:vitals', 'the longest prefix wins over the /staff rule'],
        ['/staff/referrals', 'referral:receive', 'the longest prefix wins over the /staff rule'],
        ['/staff/login', null, 'the sign-in page must stay reachable without a session'],
        ['/', null, 'the citizen portal home is public'],
        ['/services', null, 'citizen services are public'],
        ['/facilities', null, 'the facility directory is public'],
        ['/403', null, 'the refusal page must never refuse'],
    ];
    for (const [path, expected, why] of cases) {
        const actual = requiredPermissionForRoute(path);
        check(`${path} → ${expected ?? 'public'}`, actual === expected, `${why}; got ${actual ?? 'public'}`);
    }

    check('/staff/login is public for a signed-out visitor', canAccessRoute(null, '/staff/login'),
        'nobody could ever sign in');
    check('/staff is refused for a signed-out visitor', !canAccessRoute(null, '/staff'),
        'the staff workspace would be open to the public');

    const exemptionsAreExact = PUBLIC_ROUTES.every(r => requiredPermissionForRoute(r) === null);
    check('every declared public route resolves to public', exemptionsAreExact,
        'a PUBLIC_ROUTES entry is not taking effect');
    check('a public exemption does not open its subtree',
        requiredPermissionForRoute('/staff/login/audit-everything') !== null,
        'exempting /staff/login must not exempt paths beneath it');
}

// ── 7. scopeToFacility ───────────────────────────────────────────────────────
console.log('\nFacility scoping returns the right rows:');
{
    type Ref = { id: string; from: string; to: string };
    const rows: Ref[] = [
        { id: 'R1', from: 'sc-kothi', to: 'phc-bhamragad' },
        { id: 'R2', from: 'sc-govindpur', to: 'phc-perimili' },
        { id: 'R3', from: 'phc-bhamragad', to: 'chc-etapalli' },
    ];
    const ends = (r: Ref) => [r.from, r.to];
    const ids = (rs: Ref[]) => rs.map(r => r.id).sort().join(',');

    check('a district officer sees every referral',
        ids(scopeToFacility(rows, { role: 'DHO', facilityId: null }, ends)) === 'R1,R2,R3',
        'district-wide roles are not filtered, and are not blocked by a null facility either');

    check('a Sub Centre sees the referral it sent',
        ids(scopeToFacility(rows, { role: 'ANM', facilityId: 'sc-kothi' }, ends)) === 'R1',
        'the sending facility must keep seeing a referral after it arrives, or "track your referral" breaks on success');

    check('a PHC sees both the one it received and the one it sent',
        ids(scopeToFacility(rows, { role: 'MO', facilityId: 'phc-bhamragad' }, ends)) === 'R1,R3',
        'a facility is either end of a referral, never only the receiving end');

    check('a facility sees nothing addressed elsewhere',
        ids(scopeToFacility(rows, { role: 'MO', facilityId: 'phc-perimili' }, ends)) === 'R2',
        'one PHC was shown another PHC\'s patients');

    check('a session with no posting sees nothing',
        scopeToFacility(rows, { role: 'MO', facilityId: null }, ends).length === 0,
        'a half-configured session must not fall open to district-wide reach');

    check('a signed-out session sees nothing',
        scopeToFacility(rows, { role: null, facilityId: null }, ends).length === 0,
        'no session, no rows');

    const source = [...rows];
    scopeToFacility(rows, { role: 'DHO', facilityId: null }, ends).push({ id: 'X', from: 'x', to: 'y' });
    check('scoping does not mutate the caller\'s array', ids(rows) === ids(source),
        'the store\'s own list was modified by a read');
}

// ── 8. can() is closed by default ────────────────────────────────────────────
console.log('\nUnknown inputs are refused, not defaulted:');
{
    check('a null role holds nothing', !can(null, 'patient:view'), 'signed out must mean no rights');
    check('an undefined role holds nothing', !can(undefined, 'patient:view'), 'an absent role must not fall open');
    check('an unrecognised role holds nothing',
        !can('DISTRICT_KING' as StaffRole, 'patient:view'),
        'a role string from stale storage must not be honoured');
    check('canAny([]) is false', !canAny('SUPER_ADMIN', []), 'an empty requirement must not read as satisfied by chance');
    check('canAll([]) is true', canAll('ANM', []), 'requiring nothing is satisfied');
}

console.log('');
if (failures.length === 0) {
    console.log('All checks passed — the sending facility cannot answer its own referral, the');
    console.log('command centre stays district-only, a trailing slash or query string does not');
    console.log('open a guarded route, and a session without a posting reads no rows.\n');
    process.exit(0);
} else {
    console.log(`${failures.length} check(s) FAILED:`);
    failures.forEach(f => console.log(`  - ${f}`));
    console.log('');
    process.exit(1);
}
