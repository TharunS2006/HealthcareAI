/**
 * The OPD queue's figures, computed from the queue itself.
 *
 * The queue screen used to print fixed numbers — "14 min" average wait, "28
 * min" longest, "2 (MOs)" on duty, a consulted count with 38 added to it, and
 * "~15 mins" estimated wait — whatever the facility's day had actually been.
 * On a screen a Medical Officer runs the OPD from, an invented figure is worse
 * than none. Every number here is derived from the tokens' own timestamps
 * (registeredAt, calledAt, completedAt, set by lib/db.ts updateQueueStatus),
 * and a figure with nothing to derive it from is null, shown as a dash.
 *
 * Also here: how a name is shown on the waiting-room TV, which anyone in the
 * room can read (maskedName). scripts/verify-session-lock.mts checks both.
 */

import type { QueueEntry } from '@/types/facility';

type Timed = Pick<QueueEntry, 'status' | 'registeredAt' | 'calledAt' | 'completedAt' | 'consultingDoctor'>;

const sameLocalDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const time = (value: Date | string | undefined): number | null => {
    if (value === undefined) return null;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
};

const minutesBetween = (from: number, to: number) => Math.max(0, Math.round((to - from) / 60_000));

export interface QueueStats {
    /** Tokens registered today and marked completed. */
    consultedToday: number;
    /** Mean minutes from registration to being called, over tokens called today; null if none. */
    averageWaitMinutes: number | null;
    /** Longest such wait today, including anyone still waiting now; null if no token today. */
    longestWaitMinutes: number | null;
    /** Distinct doctors recorded on tokens called today; null if no doctor was recorded. */
    doctorsToday: number | null;
}

export function queueStats(queue: readonly Timed[], now: Date = new Date()): QueueStats {
    const nowMs = now.getTime();
    const today = queue.filter(q => {
        const registered = time(q.registeredAt);
        return registered !== null && sameLocalDay(new Date(registered), now);
    });

    const waits: number[] = [];
    const doctors = new Set<string>();
    for (const q of today) {
        const registered = time(q.registeredAt)!;
        const called = time(q.calledAt);
        if (called !== null) {
            waits.push(minutesBetween(registered, called));
            if (q.consultingDoctor?.trim()) doctors.add(q.consultingDoctor.trim());
        }
    }
    const stillWaiting = today
        .filter(q => q.status === 'WAITING')
        .map(q => minutesBetween(time(q.registeredAt)!, nowMs));

    const allWaits = [...waits, ...stillWaiting];
    return {
        consultedToday: today.filter(q => q.status === 'COMPLETED').length,
        averageWaitMinutes: waits.length ? Math.round(waits.reduce((a, b) => a + b, 0) / waits.length) : null,
        longestWaitMinutes: allWaits.length ? Math.max(...allWaits) : null,
        doctorsToday: doctors.size ? doctors.size : null,
    };
}

/** Minutes a waiting token has been waiting so far. */
export function minutesWaiting(entry: Pick<QueueEntry, 'registeredAt'>, now: Date = new Date()): number | null {
    const registered = time(entry.registeredAt);
    return registered === null ? null : minutesBetween(registered, now.getTime());
}

const VIRAMA = '\u094D';

function firstGrapheme(word: string): string {
    // A Devanagari letter can be several code points (क्ष = क + ् + ष). Split by
    // grapheme where the runtime can; and since older runtimes split a conjunct
    // after its virama, keep taking pieces while the initial ends in one, so it
    // is never half a letter.
    const Segmenter = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
    const pieces = Segmenter
        ? Array.from(new Segmenter(undefined, { granularity: 'grapheme' }).segment(word), p => p.segment)
        : Array.from(word);
    let initial = '';
    for (const piece of pieces) {
        initial += piece;
        if (!initial.endsWith(VIRAMA)) break;
    }
    return initial;
}

/**
 * A name as the waiting-room TV shows it: the first name and the initial of
 * each other name — "Sunita Ramdas Kowe" becomes "Sunita R. K.". Enough for a
 * patient to recognise their own call next to the token number; not enough for
 * the room to learn who is at the clinic.
 */
export function maskedName(fullName: string): string {
    const words = fullName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    const [first, ...rest] = words;
    return [first, ...rest.map(w => `${firstGrapheme(w)}.`)].join(' ');
}
