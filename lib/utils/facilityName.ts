/**
 * "Primary Health Centre — Block A" → "PHC Block A". Board cards and
 * notifications have room for the short form; the detail view shows the full name.
 */
export function shortFacilityName(name: string): string {
    return name
        .replace(/Sub-Centre \/ Ayushman Arogya Mandir/i, 'SC')
        .replace(/Primary Health Centre/i, 'PHC')
        .replace(/Community Health Centre/i, 'CHC')
        .replace(/Sub-District Hospital/i, 'SDH')
        .replace(/Sub-Centre/i, 'SC')
        .replace(/\s+—\s+/, ' ')
        .trim();
}
