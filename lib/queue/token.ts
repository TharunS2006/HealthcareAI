/**
 * OPD token numbers: in order, per facility, per day.
 *
 * Tokens were random three-digit numbers, so two patients could be handed the
 * same token on the same morning and the queue could not be called in order.
 * The next token is one more than the highest already issued today at this
 * facility under the same prefix (EMG / URG / GEN for triage, A for a booked
 * appointment), starting at 001 each day.
 *
 * Numbering is per device: two registration desks at one facility each keep
 * their own sequence. scripts/verify-queue-tokens.mts checks this.
 */

import type { QueueEntry } from '@/types/facility';

const sameLocalDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function nextTokenNumber(queue: readonly Pick<QueueEntry, 'facilityId' | 'tokenNumber' | 'registeredAt'>[], facilityId: string, prefix: string, now = new Date()): string {
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);
    let highest = 0;
    for (const entry of queue) {
        if (entry.facilityId !== facilityId || !sameLocalDay(new Date(entry.registeredAt), now)) continue;
        const match = pattern.exec(entry.tokenNumber);
        if (match) highest = Math.max(highest, Number(match[1]));
    }
    return `${prefix}-${String(highest + 1).padStart(3, '0')}`;
}
