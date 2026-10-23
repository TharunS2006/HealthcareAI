/**
 * Session tokens for the mesh relay and the district service.
 *
 * The relay checks a staff member's PIN (lib/auth/pin.ts) and returns an HS256
 * JWT naming who they are: user id, role, posting. Every later request carries
 * it, and both the relay and the district service (backend/app/access.py)
 * verify it with the same secret — so a request's identity is proven, not
 * claimed, and nobody can act as a role they did not sign in as.
 *
 * The secret comes from NALAMMESH_AUTH_SECRET. On a developer machine with no
 * such variable, the relay and the district service share one generated into
 * `.nalammesh-dev-secret` at the repository root (git-ignored), so the local
 * demo needs no setup. A hosted relay must set the variable: an instance that
 * generated its own would issue tokens no other instance accepts.
 *
 * @module server/relay/auth
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { isStaffRole, type StaffRole } from '../../lib/auth/permissions';

export const TOKEN_TTL_SECONDS = 12 * 60 * 60;
/** Failed PINs allowed before an account is locked, and for how long. */
export const MAX_PIN_FAILURES = 5;
export const LOCKOUT_SECONDS = 5 * 60;

export interface SessionClaims {
    sub: string;
    role: StaffRole;
    fac: string | null;
    name: string;
    iat: number;
    exp: number;
}

const DEV_SECRET_FILE = path.resolve(__dirname, '../../.nalammesh-dev-secret');

/** The signing secret, or null when none is configured and none can be created. */
export function resolveAuthSecret(env: NodeJS.ProcessEnv = process.env, devFile = DEV_SECRET_FILE): string | null {
    const configured = env.NALAMMESH_AUTH_SECRET?.trim();
    if (configured) return configured.length >= 32 ? configured : null;
    if (env.VERCEL || env.NODE_ENV === 'production') return null; // hosted: never invent a per-instance secret
    try {
        return fs.readFileSync(devFile, 'utf8').trim();
    } catch {
        const secret = crypto.randomBytes(32).toString('base64url');
        try {
            fs.writeFileSync(devFile, secret, { flag: 'wx', mode: 0o600 });
            return secret;
        } catch {
            // Another process created it first — read theirs.
            return fs.readFileSync(devFile, 'utf8').trim();
        }
    }
}

const b64 = (value: string | Buffer) => Buffer.from(value).toString('base64url');

export function signToken(claims: Omit<SessionClaims, 'iat' | 'exp'>, secret: string, now = Date.now(), ttl = TOKEN_TTL_SECONDS): { token: string; expiresAt: number } {
    const iat = Math.floor(now / 1000);
    const body: SessionClaims = { ...claims, iat, exp: iat + ttl };
    const unsigned = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify(body))}`;
    const signature = crypto.createHmac('sha256', secret).update(unsigned).digest('base64url');
    return { token: `${unsigned}.${signature}`, expiresAt: body.exp * 1000 };
}

/** The claims of a valid, unexpired token — null for anything else. Never throws. */
export function verifyToken(token: unknown, secret: string, now = Date.now()): SessionClaims | null {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const expected = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest();
    let given: Buffer;
    try {
        given = Buffer.from(signature, 'base64url');
    } catch {
        return null;
    }
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
    try {
        const head = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
        if (head?.alg !== 'HS256') return null;
        const c = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<SessionClaims>;
        if (typeof c.sub !== 'string' || !isStaffRole(c.role) || typeof c.exp !== 'number' || typeof c.iat !== 'number') return null;
        if (c.exp * 1000 <= now) return null;
        return { sub: c.sub, role: c.role, fac: typeof c.fac === 'string' ? c.fac : null, name: String(c.name ?? ''), iat: c.iat, exp: c.exp };
    } catch {
        return null;
    }
}

/** The bearer token of an Authorization header value. */
export function bearer(header: string | undefined | null): string | null {
    const match = /^Bearer\s+(\S+)$/i.exec(header ?? '');
    return match ? match[1] : null;
}
