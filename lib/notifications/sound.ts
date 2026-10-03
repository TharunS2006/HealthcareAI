/**
 * Emergency alert tone — optional, and only ever for Emergency cases.
 *
 * Generated with the Web Audio API rather than shipped as an audio file, so it
 * works offline and in the APK with nothing to download. Browsers only allow
 * sound after the user has interacted with the page; before that the call is a
 * silent no-op, which is acceptable because the toast and the bell still show.
 */

import type { NotificationRecord } from '@/types/referral';

const PREF_KEY = 'nalammesh-alert-sound';

let context: AudioContext | null = null;

export function alertSoundEnabled(): boolean {
    try {
        return localStorage.getItem(PREF_KEY) !== 'off';
    } catch {
        return true;
    }
}

export function setAlertSoundEnabled(on: boolean): void {
    try {
        localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
    } catch {
        /* private mode: the preference lasts for this page only */
    }
}

/** The notifications that warrant a sound: an Emergency arriving or going unanswered. */
export function isAudibleAlert(n: NotificationRecord): boolean {
    return n.priority === 'EMERGENCY' && ['REFERRAL_RECEIVED', 'EMERGENCY_REMINDER', 'EMERGENCY_ESCALATION'].includes(n.type);
}

/** Three short two-tone pulses. */
export function playEmergencyAlert(): void {
    if (typeof window === 'undefined' || !alertSoundEnabled()) return;
    try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        context = context ?? new Ctor();
        if (context.state === 'suspended') void context.resume();
        const start = context.currentTime + 0.02;
        for (let i = 0; i < 3; i++) {
            for (const [offset, freq] of [[0, 880], [0.14, 660]] as const) {
                const osc = context.createOscillator();
                const gain = context.createGain();
                osc.type = 'square';
                osc.frequency.value = freq;
                const t = start + i * 0.42 + offset;
                gain.gain.setValueAtTime(0.0001, t);
                gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
                osc.connect(gain).connect(context.destination);
                osc.start(t);
                osc.stop(t + 0.14);
            }
        }
    } catch {
        /* no audio device, or blocked — the visual alert stands */
    }
}
