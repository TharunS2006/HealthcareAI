/** Small time formatters shared by the referral and notification screens. */

/** "just now", "4 min ago", "2 h ago", "3 d ago". */
export function timeAgo(iso: string | Date | undefined, now: number = Date.now()): string {
    if (!iso) return '';
    const ms = now - new Date(iso).getTime();
    if (!Number.isFinite(ms)) return '';
    if (ms < 45_000) return 'just now';
    const min = Math.round(ms / 60_000);
    if (min < 60) return `${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 48) return `${h} h ago`;
    return `${Math.round(h / 24)} d ago`;
}

/** "14:05" in the device's timezone. */
export function clockTime(iso: string | Date | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

/** "23 Sep, 14:05". */
export function dateTime(iso: string | Date | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** "1 h 12 min" / "12 min" — a duration, not a distance from now. */
export function duration(ms: number): string {
    const min = Math.max(0, Math.round(ms / 60_000));
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}
