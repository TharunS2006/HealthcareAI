/**
 * Medicine stock register — `npm run verify:stock`
 *
 * Every change to a balance is a counted quantity (lib/stock/movement.ts):
 *
 *   1. STATUS     empty, below minimum and near expiry are told apart, in that order
 *   2. RECEIVED   adds the counted quantity, may bring a new batch and expiry
 *   3. ISSUED     subtracts it, never below zero, never touches batch or expiry
 *   4. REFUSED    no quantity, a fraction, zero or a negative changes nothing
 *   5. REORDER    the list holds exactly the lines below their minimum, emptiest
 *                 first, and its CSV cannot smuggle a spreadsheet formula
 */

const { stockStatus, applyMovement, requisitionLines, requisitionCsv, NEAR_EXPIRY_DAYS } = await import('../lib/stock/movement');
type Item = Parameters<typeof applyMovement>[0];

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
    console.log(` ${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` — ${detail}`}`);
    if (!ok) failures += 1;
};

const now = new Date(2026, 9, 10, 12, 0, 0);
const base: Item = {
    id: 'm1', facilityId: 'phc-x', facilityName: 'PHC X', name: 'Paracetamol 500 mg', category: 'Analgesic',
    dosageForm: 'Tablet', currentStock: 120, unit: 'tabs', minimumRequiredStock: 100, isEssentialIPHS: true,
    batchNumber: 'B-1', expiryDate: '2027-12-31', status: 'ADEQUATE', lastRestocked: '2026-09-01',
};

console.log('\n1. STATUS');
check('nothing left → OUT_OF_STOCK', stockStatus(0, 100, '2027-12-31', now) === 'OUT_OF_STOCK');
check('below the minimum → LOW', stockStatus(40, 100, '2027-12-31', now) === 'LOW');
check(`expiring within ${NEAR_EXPIRY_DAYS} days → NEAR_EXPIRY`, stockStatus(150, 100, '2026-11-30', now) === 'NEAR_EXPIRY');
check('below minimum outranks near expiry (reorder first)', stockStatus(40, 100, '2026-11-30', now) === 'LOW');
check('plenty, far from expiry → ADEQUATE', stockStatus(150, 100, '2027-12-31', now) === 'ADEQUATE');
check('an unreadable expiry is not a reason to alarm', stockStatus(150, 100, 'not-a-date', now) === 'ADEQUATE');

console.log('\n2. RECEIVED');
let r = applyMovement(base, 'RECEIVED', 30, {}, now);
check('adds the counted quantity', r.ok && r.item.currentStock === 150, JSON.stringify(r));
check('records the date received', r.ok && r.item.lastRestocked === '2026-10-10', r.ok ? r.item.lastRestocked : '');
check('keeps the batch when none is given', r.ok && r.item.batchNumber === 'B-1');
r = applyMovement({ ...base, currentStock: 0, status: 'OUT_OF_STOCK' }, 'RECEIVED', 500, { batchNumber: ' B-9 ', expiryDate: '2028-03-31' }, now);
check('a new batch and expiry come with the receipt', r.ok && r.item.batchNumber === 'B-9' && r.item.expiryDate === '2028-03-31', JSON.stringify(r));
check('…and the status follows the new balance', r.ok && r.item.status === 'ADEQUATE', r.ok ? r.item.status : '');

console.log('\n3. ISSUED');
r = applyMovement(base, 'ISSUED', 20, { batchNumber: 'IGNORED', expiryDate: '2030-01-01' }, now);
check('subtracts the counted quantity', r.ok && r.item.currentStock === 100);
check('an issue never changes batch or expiry', r.ok && r.item.batchNumber === 'B-1' && r.item.expiryDate === '2027-12-31');
check('an issue does not count as a receipt', r.ok && r.item.lastRestocked === '2026-09-01');
r = applyMovement(base, 'ISSUED', 120, {}, now);
check('issuing everything leaves OUT_OF_STOCK', r.ok && r.item.currentStock === 0 && r.item.status === 'OUT_OF_STOCK');
r = applyMovement(base, 'ISSUED', 121, {}, now);
check('more than is held is refused, with the balance named', !r.ok && /120 tabs/.test(r.message), JSON.stringify(r));

console.log('\n4. REFUSED');
for (const [label, q] of [['zero', 0], ['negative', -5], ['a fraction', 2.5], ['not a number', Number('abc')]] as const) {
    const x = applyMovement(base, 'RECEIVED', q as number, {}, now);
    check(`${label} is refused`, !x.ok);
}
check('a refused movement leaves the item untouched', base.currentStock === 120 && base.status === 'ADEQUATE');

console.log('\n5. REORDER');
const items: Item[] = [
    { ...base, id: 'a', name: 'A', currentStock: 120 },
    { ...base, id: 'b', name: 'B', currentStock: 0, status: 'OUT_OF_STOCK' },
    { ...base, id: 'c', name: 'C', currentStock: 60, status: 'LOW' },
    { ...base, id: 'd', name: '=HYPERLINK("http://x")', currentStock: 10, status: 'LOW' },
];
const lines = requisitionLines(items);
check('only lines below their minimum', lines.map(l => l.name).join() === 'B,=HYPERLINK("http://x"),C', lines.map(l => l.name).join());
check('the quantity brings each back to its minimum', lines.find(l => l.name === 'C')?.quantityToMinimum === 40);
const csv = requisitionCsv(lines);
check('CSV has a header row and one row per line', csv.trim().split('\r\n').length === 1 + lines.length, csv);
check('a cell that starts like a formula is neutralised', csv.includes(`"'=HYPERLINK(""http://x"")"`), csv);
check('numbers stay numbers', /,0,100,100\r\n/.test(csv), csv);

console.log('');
if (failures) {
    console.log(`${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('All checks passed — stock moves only by counted quantities, and the reorder list is exact.\n');
