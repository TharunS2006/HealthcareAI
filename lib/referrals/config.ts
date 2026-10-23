/**
 * Referral timing rules — the [X] values of the spec, in one place.
 *
 * These are service-level promises a District Health Officer is judged on, so
 * they are named constants rather than numbers scattered through screens.
 * Change them here and the escalation clock, the reservation hold, the
 * simulation page's "skip ahead" and the verify script all move together.
 */

export const REFERRAL_TIMING = {
    /** An Emergency not acknowledged this long after it was sent escalates to the DHO. */
    EMERGENCY_ACK_MINUTES: 10,
    /** While still unacknowledged, re-notify the receiver and the DHO this often. */
    EMERGENCY_REALERT_MINUTES: 10,
    /** A bed held for an accepted patient is released if they have not arrived by then. */
    RESERVATION_HOLD_HOURS: 4,
    /** How often each open app checks the escalation and reservation clocks. */
    SWEEP_INTERVAL_MS: 30_000,
    /** Relay fallback: poll over HTTP this often when the websocket is down. */
    POLL_INTERVAL_MS: 10_000,
} as const;
