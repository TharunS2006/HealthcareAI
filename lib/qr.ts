/**
 * Real, scannable QR codes for the patient wristband.
 *
 * The wristband used to draw a QR-shaped pattern from a hash of the patient's
 * data — the three corner squares and random-looking cells, but not a QR code
 * any scanner could read. A tag on a patient's wrist that cannot be scanned
 * is worse than none: it looks like it works. This encodes with
 * qrcode-generator (MIT, no dependencies), and scripts/verify-qr.mts decodes
 * the result with an independent reader to prove it round-trips.
 *
 * What goes in: the patient's record id and nothing else. A handheld barcode
 * scanner types it into the OPD search box like a keyboard, which finds the
 * record; vitals would be stale by the next shift, and a home location has no
 * business on a wristband.
 */

import qrcode from 'qrcode-generator';

/** The modules of a QR code for `text`: true is dark. Error correction M (~15%). */
export function qrMatrix(text: string): boolean[][] {
    const qr = qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/**
 * The QR code as a standalone SVG string, with the four-module quiet zone
 * scanners need. Built from the module grid only — no caller text is ever
 * placed in the markup — so it is safe to insert as HTML.
 */
export function qrSvg(text: string, sizePx = 160, colour = '#000000'): string {
    const fill = /^#[0-9a-fA-F]{6}$/.test(colour) ? colour : '#000000';
    const size = Number.isFinite(sizePx) && sizePx > 0 ? Math.round(sizePx) : 160;
    const m = qrMatrix(text);
    const quiet = 4;
    const n = m.length + quiet * 2;
    let path = '';
    m.forEach((row, r) => row.forEach((dark, c) => {
        if (dark) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR code">`
        + `<rect width="${n}" height="${n}" fill="#ffffff"/><path d="${path}" fill="${fill}"/></svg>`;
}
