/**
 * Export the role → permission table for the district service —
 * `npm run export:permissions`.
 *
 * lib/auth/permissions.ts stays the one place roles are defined. The FastAPI
 * service (backend/app/access.py) cannot import TypeScript, so it reads this
 * generated JSON instead; scripts/verify-permissions.mts fails if the JSON has
 * drifted from the TypeScript, so a role edited in one place and not
 * re-exported cannot ship unnoticed.
 */

import { writeFileSync } from 'node:fs';

const P = await import('../lib/auth/permissions');

export function permissionTable() {
    return {
        _generated_from: 'lib/auth/permissions.ts — run `npm run export:permissions` after editing roles',
        roles: Object.fromEntries(P.STAFF_ROLES.map(r => [r, [...P.ROLE_PERMISSIONS[r]].sort()])),
        district_wide: [...P.DISTRICT_WIDE_ROLES],
    };
}

if (process.argv[1]?.endsWith('export-permissions.mts')) {
    writeFileSync('backend/app/permissions.json', `${JSON.stringify(permissionTable(), null, 2)}\n`);
    console.log('Wrote backend/app/permissions.json');
}
