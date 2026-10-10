/**
 * Wristband QR codes scan — `npm run verify:qr`
 *
 * The wristband once drew a QR-shaped picture that no scanner could read.
 * lib/qr.ts now encodes a real QR code; this suite renders it to pixels and
 * reads it back with an independent decoder (jsQR), so a code that only looks
 * right fails here.
 *
 *   1. ROUND TRIP   every kind of patient id decodes to exactly itself
 *   2. MARKUP       the SVG carries no caller text, and a bad colour or size
 *                   falls back to a safe default
 */

const { qrMatrix, qrSvg } = await import('../lib/qr');
const jsQR = (await import('jsqr')).default;

let failures = 0;
const check = (label: string, ok: boolean, detail = '') => {
    console.log(` ${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` — ${detail}`}`);
    if (!ok) failures += 1;
};

/** Render the module grid as RGBA pixels with a quiet zone, as a printer would. */
function render(text: string, scale = 6, quiet = 4) {
    const m = qrMatrix(text);
    const n = m.length + quiet * 2;
    const size = n * scale;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    m.forEach((row, r) => row.forEach((dark, c) => {
        if (!dark) return;
        for (let y = 0; y < scale; y++) {
            for (let x = 0; x < scale; x++) {
                const i = (((r + quiet) * scale + y) * size + (c + quiet) * scale + x) * 4;
                data[i] = data[i + 1] = data[i + 2] = 0;
            }
        }
    }));
    return { data, size };
}

console.log('\n1. ROUND TRIP');
const ids = [
    'p-gad-1001',
    'p-8f14e45f-ceea-467a-9575-1c8d7e2b5f3a',
    'p-demo-a1b2c3',
    'b3c1d9e2-0f4a-4e7b-9c2d-6a5f8e1d2c3b',
];
for (const id of ids) {
    const { data, size } = render(id);
    const read = jsQR(data, size, size);
    check(`"${id}" scans back as itself`, read?.data === id, read ? JSON.stringify(read.data) : 'not readable');
}
const small = render('p-8f14e45f-ceea-467a-9575-1c8d7e2b5f3a', 2);
check('still readable printed small (2 px per module)', jsQR(small.data, small.size, small.size)?.data === 'p-8f14e45f-ceea-467a-9575-1c8d7e2b5f3a');

console.log('\n2. MARKUP');
const hostile = '<script>alert(1)</script>';
const svg = qrSvg(hostile);
check('the SVG never contains the encoded text', !svg.includes('<script') && !svg.includes('alert'), svg.slice(0, 120));
check('a colour that is not #rrggbb falls back to black', qrSvg('x', 100, 'red"/><script>').includes('fill="#000000"'));
check('a size that is not a positive number falls back', qrSvg('x', Number.NaN).includes('width="160"'));
const d = qrSvg('p-gad-1001').match(/<path d="([^"]*)"/)?.[1] ?? '';
check('the drawn path is well-formed SVG (only "Mx yh1v1h-1z" squares)', /^(M\d+ \d+h1v1h-1z)+$/.test(d), d.slice(0, 60));
check('the quiet zone is there (4 modules each side)', /viewBox="0 0 (\d+) \1"/.test(svg) && Number(svg.match(/viewBox="0 0 (\d+)/)![1]) === qrMatrix(hostile).length + 8);

console.log('');
if (failures) {
    console.log(`${failures} check(s) FAILED`);
    process.exit(1);
}
console.log('All checks passed — wristband QR codes are real and scan back to the patient id.\n');
