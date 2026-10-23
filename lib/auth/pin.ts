/**
 * Staff PINs — hashed, never stored.
 *
 * A PIN is stored as `pbkdf2-sha256$<iterations>$<salt>$<hash>` (base64url),
 * computed with WebCrypto, so the browser, the mesh relay and the verify
 * scripts all check it the same way. Verification runs in two places:
 *
 *   the mesh relay  the authority: it checks the PIN, counts failures and
 *                   issues the signed session token the relay and the district
 *                   service accept (server/relay/auth.ts)
 *   this device     only when the relay cannot be reached, so a Sub Centre
 *                   with no signal can still work. That session carries no
 *                   token: nothing it does reaches the network until the user
 *                   re-enters their PIN while connected.
 *
 * Hashes travel with the staff directory so offline sign-in works on every
 * device. A 4–6 digit PIN behind PBKDF2 slows guessing but does not stop a
 * determined attacker holding a device's copy — the online lockout and the
 * token are what the network relies on.
 *
 * @module lib/auth/pin
 */

export const PIN_PATTERN = /^\d{4,6}$/;
const ITERATIONS = 120_000;
const PREFIX = 'pbkdf2-sha256';

function toB64url(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text: string): Uint8Array {
    const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
    return Uint8Array.from(s, c => c.charCodeAt(0));
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await globalThis.crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
        key,
        256
    );
    return new Uint8Array(bits);
}

/** Hash a PIN for storage. Throws if the PIN is not 4–6 digits. */
export async function hashPin(pin: string, iterations = ITERATIONS): Promise<string> {
    if (!PIN_PATTERN.test(pin)) throw new Error('A PIN is 4 to 6 digits');
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    return `${PREFIX}$${iterations}$${toB64url(salt)}$${toB64url(await derive(pin, salt, iterations))}`;
}

/** Does this PIN match the stored hash? False for a missing or malformed hash — never throws. */
export async function verifyPin(pin: string, stored: string | undefined | null): Promise<boolean> {
    if (!stored || !PIN_PATTERN.test(pin)) return false;
    const [prefix, iter, salt, hash] = stored.split('$');
    const iterations = Number(iter);
    if (prefix !== PREFIX || !Number.isInteger(iterations) || iterations < 1000 || !salt || !hash) return false;
    let expected: Uint8Array;
    let actual: Uint8Array;
    try {
        expected = fromB64url(hash);
        actual = await derive(pin, fromB64url(salt), iterations);
    } catch {
        return false;
    }
    if (expected.length !== actual.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
    return diff === 0;
}
