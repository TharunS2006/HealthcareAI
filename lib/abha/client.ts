/**
 * The citizen's side of ABHA verification: ask the relay (server/relay/abha.ts),
 * which holds the ABDM sandbox credentials, to send and check the OTP.
 *
 * @module lib/abha/client
 */

import { relayBaseUrl } from '@/lib/socket';
import { blockedAsMixedContent } from '@/lib/cloudEndpoint';

export interface VerifiedAbha {
    name: string;
    /** As ABDM returns it — partly masked. */
    abhaNumber: string;
    abhaAddress: string | null;
    status: string;
    verifiedAt: string;
}

export type AbhaAnswer<T> =
    | { ok: true; value: T }
    | { ok: false; kind: 'unavailable' | 'not-configured' | 'refused'; message: string };

const CITIZEN_KEY = 'nalammesh-citizen';

async function post<T>(path: string, body: object): Promise<AbhaAnswer<T>> {
    const url = `${relayBaseUrl()}${path}`;
    if (blockedAsMixedContent(url)) return { ok: false, kind: 'unavailable', message: 'The verification service cannot be reached from this page' };
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(20_000),
        });
        const data = (await response.json().catch(() => ({}))) as T & { error?: string };
        if (response.ok) return { ok: true, value: data };
        if (response.status === 503) return { ok: false, kind: 'not-configured', message: data.error ?? 'ABHA verification is not configured on this server' };
        if (response.status >= 500 || response.status === 404) return { ok: false, kind: 'unavailable', message: data.error ?? 'The ABDM sandbox could not be reached — try again' };
        return { ok: false, kind: 'refused', message: data.error ?? `Refused (HTTP ${response.status})` };
    } catch {
        return { ok: false, kind: 'unavailable', message: 'The verification service could not be reached — check the connection and try again' };
    }
}

export const requestAbhaOtp = (abhaNumber: string) => post<{ txnId: string; message: string }>('/api/abha/otp', { abhaNumber });

export async function verifyAbhaOtp(txnId: string, otp: string): Promise<AbhaAnswer<VerifiedAbha>> {
    const answer = await post<{ verified: boolean; account: Omit<VerifiedAbha, 'verifiedAt'> }>('/api/abha/verify', { txnId, otp });
    if (!answer.ok) return answer;
    const citizen: VerifiedAbha = { ...answer.value.account, verifiedAt: new Date().toISOString() };
    try {
        sessionStorage.setItem(CITIZEN_KEY, JSON.stringify(citizen));
    } catch {
        /* private mode: verified for this page only */
    }
    return { ok: true, value: citizen };
}

/** The citizen verified in this tab, if any. */
export function verifiedCitizen(): VerifiedAbha | null {
    try {
        return JSON.parse(sessionStorage.getItem(CITIZEN_KEY) ?? 'null') as VerifiedAbha | null;
    } catch {
        return null;
    }
}
