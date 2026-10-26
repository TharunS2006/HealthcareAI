/**
 * Which copy of a patient record is newer.
 *
 * `timestamp` is when the patient was registered, and screens read it that way
 * ("registered today"), so it must not move when the record is edited. Every
 * change made on a device stamps `updatedAt` instead, and devices and the relay
 * keep the copy with the later version. A record from an older build has no
 * `updatedAt`; its version is its registration time, as before.
 */

type Versioned = { updatedAt?: string; timestamp: Date | string };

/** Milliseconds since the epoch of the record's last change; 0 if it carries no usable time. */
export function patientVersion(p: Versioned): number {
    const t = Date.parse(p.updatedAt ?? String(p.timestamp));
    if (Number.isFinite(t)) return t;
    const registered = Date.parse(String(p.timestamp));
    return Number.isFinite(registered) ? registered : 0;
}

/** True when `incoming` should replace `existing` — strictly newer, so a replay of the same copy is ignored. */
export function isNewerPatient(incoming: Versioned, existing: Versioned | undefined): boolean {
    return !existing || patientVersion(incoming) > patientVersion(existing);
}

/** The record as changed now: `updatedAt` set, `timestamp` (registration) untouched. */
export function stampChange<T extends Versioned>(p: T, now: Date = new Date()): T {
    return { ...p, updatedAt: now.toISOString() };
}
