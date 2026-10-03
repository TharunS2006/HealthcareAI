/**
 * Production build on the device — `npm run verify:production-mode`
 *
 * Runs the app's own database code as a production build
 * (NEXT_PUBLIC_DEPLOYMENT_MODE=production, lib/config/mode.ts) and checks:
 *
 *   1. EMPTY START   a new device gets the facility list and nothing else —
 *                    no fictional patient, referral, stock, bed report or
 *                    demo account
 *   2. NO DEMO       the demonstration pages are closed and the reset to
 *                    demonstration data refuses
 *   3. STAFF ID      with no relay, a Staff ID this device has never seen
 *                    cannot sign in, and says to connect once
 */

process.env.NEXT_PUBLIC_DEPLOYMENT_MODE = 'production';
import 'fake-indexeddb/auto';

const print = console.log.bind(console);
for (const level of ['info', 'warn', 'error', 'log'] as const) console[level] = () => {};
let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) print(` PASS ${label}`);
    else {
        failures += 1;
        print(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}
// Node has a navigator with no onLine; a browser always has one.
Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });
// No relay answers here.
globalThis.fetch = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;

const { PRODUCTION } = await import('../lib/config/mode');
const DB = await import('../lib/db');
const { FACILITY_NETWORK } = await import('../lib/data/facilities');
const { canAccessRoute } = await import('../lib/auth/permissions');
const { signInWithStaffId } = await import('../lib/auth/signIn');

print('\n1. EMPTY START');
check('the build is in production mode', PRODUCTION === true);
const db = await DB.getDB();
const count = async (store: string) => db.count(store as never);
check('the facility list is installed', (await count('facilities')) === FACILITY_NETWORK.length, String(await count('facilities')));
for (const store of ['patients', 'referrals', 'queue', 'medicineStock', 'diagnostics', 'notifications', 'users', 'facilityResources', 'maintenanceLog']) {
    check(`no demonstration ${store}`, (await count(store)) === 0, String(await count(store)));
}
check('the staff directory is empty, not the demo roster', (await DB.getUsers()).length === 0);
// What the screens read: an empty store reads empty — no demonstration record
// is handed back in its place (and so none is shown, or published to the relay).
const reads: [string, () => Promise<unknown[]>][] = [
    ['patients', DB.getAllPatients], ['referrals', DB.getAllReferrals], ['OPD queue', () => DB.getQueueEntries()],
    ['medicine stock', DB.getAllMedicines], ['diagnostic orders', DB.getAllDiagnostics],
    ['bed reports', DB.getAllResources], ['maintenance tickets', DB.getMaintenanceTickets],
];
for (const [what, read] of reads) {
    const rows = await read();
    check(`reading ${what} from an empty store gives nothing, not demonstration data`, rows.length === 0, String(rows.length));
}

print('\n2. NO DEMO');
check('the Two-User Simulation is closed, even to the Super Admin', !canAccessRoute('SUPER_ADMIN', '/demo/simulation'));
check('other pages are unaffected', canAccessRoute('SUPER_ADMIN', '/admin') && canAccessRoute('ANM', '/opd'));
let refused = false;
try { await DB.resetToDefaultSeed(); } catch { refused = true; }
check('resetting to demonstration data refuses', refused);
check('…and wrote nothing', (await count('patients')) === 0 && (await count('users')) === 0);

print('\n3. STAFF ID');
const unknown = await signInWithStaffId('ANM-KOT-1021', '2468', await DB.getUsers());
check('with no relay, a Staff ID this device has never seen cannot sign in', !unknown.ok);
check('…and is told to connect once', !unknown.ok && /connected/.test(unknown.message), unknown.ok ? '' : unknown.message);

await DB.closeDB();
print(failures === 0 ? '\nAll production-mode checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
