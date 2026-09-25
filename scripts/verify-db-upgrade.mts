/**
 * Device-database upgrade check — `npm run verify:db-upgrade`
 *
 * Every device carries its own IndexedDB, created by whichever build it first
 * ran. The upgrade in lib/db.ts must bring each of them to the current schema
 * with its data intact, or every screen on that device fails. This builds each
 * kind of database a device can hold today, opens it with the current code, and
 * checks what comes out:
 *
 *   1. FRESH DEVICE        seeded from scratch at v6
 *   2. v4, PRE-RENAME      data from before commit 566bf16 changed the District
 *                          Hospital's id: facility list replaced, every record
 *                          re-keyed, the audit log left as written
 *   3. v4, POST-RENAME     the ordinary v4 → v6 path
 *   4. ABANDONED v5        a development build also used version 5, with none
 *                          of the v5 stores and another referral format
 *   5. v5 FROM PRE-RENAME  this build's v5 upgraded from pre-rename data
 *   6. v5, EDITED LIST     a facility the Super Admin renamed is kept
 *   7. CONCURRENT OPENS    one open shared by every caller
 *   8. OLD TAB OPEN        upgrade waits for it, then completes
 *   9. NEWER TAB           this page steps aside and says to reload
 *  10. MESH ARRIVALS       referrals from a not-yet-upgraded device
 *  11. FAILED MIGRATION    rolled back whole: old version, records untouched
 *  12. PINS BACKFILLED     seeded accounts stored before PINs get theirs; admin-set PINs kept
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

// A rejection nobody handles is a failure to report, not a reason to stop the run.
process.on('unhandledRejection', reason => {
    check('no unhandled rejection', false, reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason));
});

// The code under test logs as it seeds; keep the report readable.
const logged: string[] = [];
for (const level of ['info', 'warn', 'error'] as const) {
    console[level] = (...args: unknown[]) => { logged.push(`${level}: ${args.map(String).join(' ')}`); };
}

const DB = await import('../lib/db');
const { FACILITY_NETWORK, SEED_PATIENTS } = await import('../lib/data/facilities');
const { SEED_REFERRALS } = await import('../lib/data/referralSeed');
const { SEED_USERS } = await import('../lib/auth/users');
const { SEED_RESOURCES } = await import('../lib/data/resources');
const { normalizeReferral } = await import('../lib/referrals/workflow');

const NAME = 'nalammesh-rural-db';
const RETIRED = 'dh-gadchiroli';
const CURRENT = 'dh-district';

type Schema = Record<string, { keyPath?: string; indexes: [string, string][] }>;
const V4_SCHEMA: Schema = {
    patients: { indexes: [['by-sync', 'isSynced'], ['by-timestamp', 'timestamp'], ['by-triage', 'triageStatus']] },
    referrals: { indexes: [['by-status', 'status'], ['by-priority', 'priority'], ['by-from-facility', 'fromFacilityId'], ['by-to-facility', 'toFacilityId']] },
    queue: { indexes: [['by-facility', 'facilityId'], ['by-status', 'status'], ['by-priority', 'priority']] },
    facilities: { indexes: [['by-type', 'type'], ['by-district', 'district']] },
    medicineStock: { indexes: [['by-facility', 'facilityId'], ['by-status', 'status'], ['by-category', 'category']] },
    diagnostics: { indexes: [['by-facility', 'facilityId'], ['by-patient', 'patientId'], ['by-status', 'status']] },
    syncQueue: { indexes: [['by-retry', 'retryCount']] },
    auditLog: { indexes: [['by-entity', 'entityType'], ['by-timestamp', 'timestamp'], ['by-actor', 'actorId']] },
    appointments: { indexes: [['by-facility', 'facilityId'], ['by-date', 'requestedDate'], ['by-patient', 'patientId'], ['by-status', 'status']] },
};
const V5_SCHEMA: Schema = {
    ...V4_SCHEMA,
    notifications: { indexes: [['by-recipient', 'recipient_user_id'], ['by-referral', 'referral_id'], ['by-created', 'created_at']] },
    users: { indexes: [['by-role', 'role']] },
    facilityResources: { keyPath: 'facilityId', indexes: [] },
    maintenanceLog: { indexes: [['by-facility', 'facilityId'], ['by-status', 'status']] },
};

const request = <T,>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

/** Build a database the way an older build left it, with the given rows. */
async function createDevice(version: number, schema: Schema, rows: Record<string, unknown[]>): Promise<void> {
    const open = indexedDB.open(NAME, version);
    open.onupgradeneeded = () => {
        for (const [store, def] of Object.entries(schema)) {
            const s = open.result.createObjectStore(store, { keyPath: def.keyPath ?? 'id' });
            for (const [index, key] of def.indexes) s.createIndex(index, key);
        }
    };
    const db = await request(open);
    const stores = Object.keys(rows).filter(s => rows[s].length > 0);
    if (stores.length > 0) {
        const tx = db.transaction(stores, 'readwrite');
        for (const s of stores) for (const row of rows[s]) tx.objectStore(s).put(row);
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    }
    db.close();
}

async function wipe(): Promise<void> {
    await DB.closeDB();
    // A new, empty browser for the next scenario, so nothing a failed scenario
    // left open (the old code leaked a connection per failed attempt) blocks it.
    globalThis.indexedDB = new IDBFactory();
}

/** Run one scenario; an exception is a failure of that scenario, not the end of the run. */
async function scenario(title: string, body: () => Promise<void>): Promise<void> {
    console.log(`\n${title}`);
    try {
        await body();
    } catch (error) {
        check('runs without throwing', false, error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    } finally {
        await wipe();
    }
}

/** Everything on the device after the current code has opened it. */
async function snapshot() {
    const db = await DB.getDB();
    const all: Record<string, any[]> = {};
    for (const store of db.objectStoreNames) all[store] = await db.getAll(store as any);
    return { version: db.version, stores: [...db.objectStoreNames].sort(), all };
}

const byId = (rows: any[], id: string) => rows.find(r => r.id === id);
const mentions = (rows: unknown[], text: string) => JSON.stringify(rows).includes(`"${text}"`);
const isCurrentEvent = (e: any) => typeof e?.action === 'string' && typeof e?.toStatus === 'string' && typeof e?.actor === 'object' && e.actor !== null;

/** Facility list from before 566bf16: the District Hospital under its old id. */
const PRE_RENAME_FACILITIES = FACILITY_NETWORK.map(f => ({
    ...f,
    id: f.id === CURRENT ? RETIRED : f.id,
    name: `${f.name} (pre-rename seed)`,
    ...(f.parentFacilityId === CURRENT ? { parentFacilityId: RETIRED } : {}),
}));
const LEGACY_SEED = ['ref-2025-01', 'ref-2025-02', 'ref-2025-03', 'ref-2025-04'].map((id, i) => ({
    id, patientId: SEED_PATIENTS[i].id, patientName: SEED_PATIENTS[i].name, status: 'IN_TRANSIT', priority: 'RED',
    fromFacilityId: 'phc-bhamragad', fromFacilityName: 'PHC', toFacilityId: RETIRED, toFacilityName: 'DH', referredAt: '2026-09-01T08:00:00.000Z', reason: 'seed',
}));
/** Referred by staff on the device, to the District Hospital under its old id. */
const USER_REFERRAL = {
    id: 'REF-USER-01', patientId: 'p-user-01', patientName: 'Test Patient', patientAge: 40, patientGender: 'F', status: 'INITIATED', priority: 'RED',
    fromFacilityId: 'phc-bhamragad', fromFacilityName: 'PHC', toFacilityId: RETIRED, toFacilityName: 'DH (old name)',
    referredAt: '2026-09-20T10:00:00.000Z', referredBy: 'Dr. Test', reason: 'Suspected eclampsia',
};
const USER_PATIENT = {
    id: 'p-user-01', name: 'Test Patient', age: 40, gender: 'F', triageStatus: 'RED', isSynced: false, timestamp: '2026-09-19T10:00:00.000Z',
    visits: [{ id: 'v-01', date: '2026-09-19T10:00:00.000Z', facilityId: RETIRED, facilityName: 'DH (old name)' }],
};
const AUDIT_ROW = { id: 'audit-01', entityType: 'REFERRAL', entityId: 'REF-USER-01', action: 'CREATE', actorId: 'u-x', timestamp: '2026-09-20T10:00:00.000Z', after: { toFacilityId: RETIRED } };
const APPOINTMENT = { id: 'appt-01', facilityId: RETIRED, patientId: 'p-user-01', requestedDate: '2026-09-25', status: 'REQUESTED' };

function expectCurrentFacilityList(label: string, facilities: any[]): void {
    const ids = facilities.map(f => f.id).sort();
    check(`${label}: facility list is the current network`, JSON.stringify(ids) === JSON.stringify(FACILITY_NETWORK.map(f => f.id).sort()), ids.join());
    check(`${label}: District Hospital under ${CURRENT}, with its current name`,
        byId(facilities, CURRENT)?.name === byId(FACILITY_NETWORK as any[], CURRENT)?.name);
}
function expectConsistentKeys(label: string, all: Record<string, any[]>): void {
    const ids = new Set(all.facilities.map(f => f.id));
    const orphanBeds = all.facilityResources.filter(r => !ids.has(r.facilityId)).map(r => r.facilityId);
    check(`${label}: every bed return belongs to a listed facility`, orphanBeds.length === 0, orphanBeds.join());
    const orphanStaff = all.users.filter(u => u.facilityId && !ids.has(u.facilityId)).map(u => u.id);
    check(`${label}: every staff posting is a listed facility`, orphanStaff.length === 0, orphanStaff.join());
    const stale = Object.keys(all).filter(s => s !== 'auditLog' && mentions(all[s], RETIRED));
    check(`${label}: no record outside the audit log names ${RETIRED}`, stale.length === 0, stale.join());
}

await scenario('1. FRESH DEVICE', async () => {
    const s = await snapshot();
    check('opens at version 6', s.version === 6, String(s.version));
    check('has all 13 stores', s.stores.length === 13, s.stores.join());
    expectCurrentFacilityList('fresh', s.all.facilities);
    check('staff directory seeded', s.all.users.length === SEED_USERS.length);
    check('bed returns seeded for every hospital', s.all.facilityResources.length === SEED_RESOURCES.length);
    expectConsistentKeys('fresh', s.all);
});

await scenario('2. v4, PRE-RENAME', async () => {
    await createDevice(4, V4_SCHEMA, {
        facilities: PRE_RENAME_FACILITIES,
        patients: [...SEED_PATIENTS.slice(0, 5), USER_PATIENT],
        referrals: [...LEGACY_SEED, USER_REFERRAL],
        appointments: [APPOINTMENT],
        auditLog: [AUDIT_ROW],
    });
    const s = await snapshot();
    check('upgraded to version 6 with all 13 stores', s.version === 6 && s.stores.length === 13);
    expectCurrentFacilityList('pre-rename', s.all.facilities);
    expectConsistentKeys('pre-rename', s.all);
    const ref = byId(s.all.referrals, 'REF-USER-01');
    check('the device\'s own referral is kept', Boolean(ref));
    check('… now sent to the District Hospital under its current id', ref?.toFacilityId === CURRENT, ref?.toFacilityId);
    check('… on the new lifecycle (INITIATED → SENT)', ref?.status === 'SENT', ref?.status);
    check('… with a readable timeline', Array.isArray(ref?.timeline) && ref.timeline.length > 0 && ref.timeline.every(isCurrentEvent));
    check('old demo referrals replaced by the current seed',
        LEGACY_SEED.every(r => !byId(s.all.referrals, r.id)) && SEED_REFERRALS.every(r => byId(s.all.referrals, r.id)));
    const pt = byId(s.all.patients, 'p-user-01');
    check('patient visit re-keyed', pt?.visits?.[0]?.facilityId === CURRENT, pt?.visits?.[0]?.facilityId);
    check('patient registered where first referred from', pt?.registeredAtFacilityId === 'phc-bhamragad', pt?.registeredAtFacilityId);
    check('appointment re-keyed', byId(s.all.appointments, 'appt-01')?.facilityId === CURRENT);
    check('audit log left exactly as written', JSON.stringify(byId(s.all.auditLog, 'audit-01')) === JSON.stringify(AUDIT_ROW));
});

await scenario('3. v4, POST-RENAME', async () => {
    await createDevice(4, V4_SCHEMA, {
        facilities: FACILITY_NETWORK,
        patients: SEED_PATIENTS.slice(0, 5),
        referrals: [...LEGACY_SEED.map(r => ({ ...r, toFacilityId: CURRENT })), { ...USER_REFERRAL, toFacilityId: CURRENT, status: 'COMPLETED' }],
    });
    const s = await snapshot();
    check('upgraded to version 6', s.version === 6);
    expectCurrentFacilityList('post-rename', s.all.facilities);
    expectConsistentKeys('post-rename', s.all);
    const ref = byId(s.all.referrals, 'REF-USER-01');
    check('COMPLETED becomes ADMITTED', ref?.status === 'ADMITTED', ref?.status);
});

await scenario('4. ABANDONED v5', async () => {
    const stashEvent = (id: string, status: string, at: string) => ({ id, at, status, actorId: 'u-anm-kothi', actorRole: 'ANM', facilityId: 'sc-kothi' });
    await createDevice(5, V4_SCHEMA, {
        facilities: FACILITY_NETWORK,
        patients: SEED_PATIENTS.slice(0, 5),
        referrals: [
            {
                ...USER_REFERRAL, id: 'REF-STASH-01', toFacilityId: 'phc-bhamragad', status: 'DELIVERED',
                timeline: [stashEvent('e1', 'CREATED', '2026-09-23T08:00:00.000Z'), stashEvent('e2', 'SENT', '2026-09-23T08:00:05.000Z'), stashEvent('e3', 'DELIVERED', '2026-09-23T08:03:00.000Z')],
                comments: [{ id: 'c1', at: '2026-09-23T08:04:00.000Z', authorId: 'u-mo', authorRole: 'MO', facilityId: 'phc-bhamragad', facilityName: 'PHC', text: 'Bed ready' }],
            },
            { ...USER_REFERRAL, id: 'REF-STASH-02', toFacilityId: 'phc-bhamragad', status: 'CREATED', timeline: [stashEvent('e4', 'CREATED', '2026-09-23T09:00:00.000Z')] },
        ],
    });
    const s = await snapshot();
    check('opens instead of failing on every read', s.version === 6 && s.stores.length === 13, s.stores.join());
    check('staff directory and bed returns seeded', s.all.users.length === SEED_USERS.length && s.all.facilityResources.length === SEED_RESOURCES.length);
    const delivered = byId(s.all.referrals, 'REF-STASH-01');
    check('referral keeps its status', delivered?.status === 'DELIVERED', delivered?.status);
    check('its timeline is readable by every screen', delivered?.timeline?.every(isCurrentEvent));
    check('… ends on the step that reached DELIVERED', delivered?.timeline?.at(-1)?.action === 'OPEN', delivered?.timeline?.at(-1)?.action);
    check('… and says what could not be read', /development build/.test(delivered?.timeline?.at(-1)?.note ?? ''));
    check('no unreadable comment reaches a screen', Array.isArray(delivered?.comments) && delivered.comments.every((c: any) => typeof c.actor === 'object'));
    const created = byId(s.all.referrals, 'REF-STASH-02');
    check('a referral never sent is not shown as sent', created?.status === 'CREATED' && created?.timeline?.length === 1 && created.timeline[0].action === 'CREATE');
});

await scenario('5. v5 FROM PRE-RENAME', async () => {
    const seeded = structuredClone(SEED_REFERRALS[0]) as any;
    const v5Referral = {
        ...seeded, id: 'REF-V5-01', toFacilityId: RETIRED,
        timeline: seeded.timeline.map((e: any) => ({ ...e, id: `v5:${e.id}`, actor: { ...e.actor, facilityId: RETIRED } })),
    };
    await createDevice(5, V5_SCHEMA, {
        facilities: PRE_RENAME_FACILITIES,
        patients: SEED_PATIENTS,
        referrals: [...SEED_REFERRALS, v5Referral],
        users: SEED_USERS,
        facilityResources: SEED_RESOURCES,
    });
    const s = await snapshot();
    check('upgraded to version 6', s.version === 6);
    expectCurrentFacilityList('v5 pre-rename', s.all.facilities);
    expectConsistentKeys('v5 pre-rename', s.all);
    const ref = byId(s.all.referrals, 'REF-V5-01');
    check('referral re-keyed, including who acted where', ref?.toFacilityId === CURRENT && ref.timeline.every((e: any) => e.actor.facilityId === CURRENT));
    check('its timeline kept, not rebuilt', JSON.stringify(ref?.timeline.map((e: any) => e.id)) === JSON.stringify(v5Referral.timeline.map((e: any) => e.id)));
});

await scenario('6. v5, EDITED LIST', async () => {
    const edited = FACILITY_NETWORK.map(f => (f.id === 'phc-perimili' ? { ...f, name: 'PHC renamed by the Super Admin' } : f));
    await createDevice(5, V5_SCHEMA, { facilities: edited, patients: SEED_PATIENTS, users: SEED_USERS, facilityResources: SEED_RESOURCES });
    const s = await snapshot();
    check('a facility the Super Admin edited keeps the edit', byId(s.all.facilities, 'phc-perimili')?.name === 'PHC renamed by the Super Admin');
});

await scenario('7. CONCURRENT OPENS', async () => {
    await createDevice(4, V4_SCHEMA, { facilities: PRE_RENAME_FACILITIES, patients: SEED_PATIENTS.slice(0, 5), referrals: LEGACY_SEED });
    const opened = await Promise.all(Array.from({ length: 12 }, () => DB.getDB()));
    check('twelve callers share one connection', opened.every(db => db === opened[0]));
    const s = await snapshot();
    check('… and the upgrade ran once, cleanly', s.version === 6 && s.all.users.length === SEED_USERS.length);
});

await scenario('8. OLD TAB OPEN', async () => {
    await createDevice(4, V4_SCHEMA, { facilities: FACILITY_NETWORK, patients: SEED_PATIENTS.slice(0, 5) });
    const oldTab = await request(indexedDB.open(NAME, 4)); // an older build: never closes on versionchange
    let settled = false;
    const pending = DB.getDB().then(db => { settled = true; return db; });
    await new Promise(r => setTimeout(r, 200));
    check('upgrade waits while an old tab holds the database', !settled);
    check('… and says so', logged.some(l => l.includes('waiting for another NalamMesh tab')));
    oldTab.close();
    const db = await pending;
    check('… then completes once that tab closes', db.version === 6);
});

await scenario('9. NEWER TAB', async () => {
    await DB.getDB();
    const newer = indexedDB.open(NAME, 7);
    newer.onupgradeneeded = () => { /* a future build */ };
    // Without the fix this page keeps its connection open and the newer tab waits forever.
    const newerDb = await Promise.race([
        request(newer),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('the newer tab is still blocked by this page after 3 s')), 3000)),
    ]);
    check('this page lets a newer version upgrade', newerDb.version === 7);
    let refused = '';
    try { await DB.getDB(); } catch (e) { refused = e instanceof Error ? e.message : String(e); }
    check('… then refuses reads and asks for a reload', /Reload this page/.test(refused), refused);
    newerDb.close();
});

await scenario('10. MESH ARRIVALS', async () => {
    const seeded = structuredClone(SEED_REFERRALS[0]) as any;
    const arrived = normalizeReferral({ ...seeded, toFacilityId: RETIRED, timeline: seeded.timeline.map((e: any) => ({ ...e, actor: { ...e.actor, facilityId: RETIRED } })) });
    check('a referral from a not-yet-upgraded device is re-keyed on read', arrived.toFacilityId === CURRENT && !mentions([arrived], RETIRED));
    check('… keeping its timeline', arrived.timeline.length === seeded.timeline.length);
    const unchanged = normalizeReferral(seeded);
    check('a current referral passes through untouched', JSON.stringify(unchanged.timeline) === JSON.stringify(seeded.timeline));
});

await scenario('11. FAILED MIGRATION', async () => {
    // A record the migration cannot read: its referral date is not a date.
    await createDevice(4, V4_SCHEMA, {
        facilities: PRE_RENAME_FACILITIES,
        patients: [USER_PATIENT],
        referrals: [{ ...USER_REFERRAL, referredAt: 'not a date' }],
    });
    let refused = '';
    try { await DB.getDB(); } catch (e) { refused = e instanceof Error ? e.message : String(e); }
    check('the open fails loudly', /Failed to initialize database/.test(refused), refused);
    check('… and the log names the cause', logged.some(l => l.includes('rolled back') && l.includes('RangeError')));
    await DB.closeDB();
    const raw = await request(indexedDB.open(NAME)); // no version given: look, do not upgrade
    const version = raw.version;
    const facilities = await request(raw.transaction('facilities').objectStore('facilities').getAll());
    const referral = await request(raw.transaction('referrals').objectStore('referrals').get('REF-USER-01'));
    raw.close();
    check('the device stays on version 4, not half-migrated at 6', version === 4, String(version));
    check('… with its records exactly as they were', facilities.some((f: any) => f.id === RETIRED) && (referral as any)?.status === 'INITIATED');
});

await scenario('12. STAFF LIST FROM BEFORE PINS', async () => {
    // A browser that stored the directory before sign-in checked PINs: seeded
    // accounts with no hash, except one whose PIN the Super Admin has set.
    const { verifyPin } = await import('../lib/auth/pin');
    const { DEMO_PIN } = await import('../lib/auth/users');
    const adminSet = await (await import('../lib/auth/pin')).hashPin('9753');
    const stored = SEED_USERS.map(({ pinHash: _drop, ...u }) => (u.id === 'u-mo-perimili' ? { ...u, pinHash: adminSet } : u));
    await createDevice(6, V5_SCHEMA, { facilities: FACILITY_NETWORK, patients: SEED_PATIENTS, users: stored, facilityResources: SEED_RESOURCES });
    const s = await snapshot();
    const anm = byId(s.all.users, 'u-anm-kothi');
    check('seeded accounts get their PIN back, so the demo PIN signs in', await verifyPin(DEMO_PIN, anm?.pinHash));
    check('every seeded account can sign in', (await Promise.all(s.all.users.filter(u => u.id !== 'u-mo-perimili').map(u => verifyPin(DEMO_PIN, u.pinHash)))).every(Boolean));
    const mo = byId(s.all.users, 'u-mo-perimili');
    check('a PIN the Super Admin set is kept, not reset to the demo PIN', await verifyPin('9753', mo?.pinHash) && !(await verifyPin(DEMO_PIN, mo?.pinHash)));
});

console.log(failures === 0 ? '\nAll device-database upgrade checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
if (failures > 0) process.stdout.write(`Log:\n${logged.join('\n')}\n`);
process.exit(failures === 0 ? 0 : 1);
