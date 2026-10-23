/**
 * "Connected — enter your PIN to sync."
 *
 * A session signed in while the relay was unreachable, or whose token has
 * expired, keeps working on this device but sends nothing to the network
 * (lib/referrals/transport.ts). The moment the relay can be reached this bar
 * asks for the PIN once, gets a token, and pushes what was waiting.
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useMeshStatus } from '@/lib/hooks/useMeshStatus';
import { relaySignIn } from '@/lib/auth/signIn';
import { useReferralStore } from '@/stores/referralStore';
import toast from 'react-hot-toast';

export default function NetworkSignIn() {
    const session = useAuthStore(s => s.session);
    const setToken = useAuthStore(s => s.setToken);
    const status = useMeshStatus();
    const [pin, setPin] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(() => Date.now());

    // Re-check expiry each minute, so an expired token is noticed without a reload.
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(t);
    }, []);

    const hasToken = Boolean(session?.token && (session.tokenExpiresAt ?? 0) > now);
    if (!session || hasToken || status !== 'ONLINE') return null;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const answer = await relaySignIn(session.userId, pin);
        setBusy(false);
        if (answer.kind === 'token') {
            setToken(answer.token, answer.expiresAt);
            setPin('');
            toast.success('Connected — your changes are syncing');
            void useReferralStore.getState().pushPending();
        } else {
            setError(answer.kind === 'refused' ? answer.message : 'The network could not be reached — try again');
        }
    };

    return (
        <div role="region" aria-label="Sign in to the network" className="bg-amber-50 border-b border-amber-300">
            <form onSubmit={submit} className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center gap-2 text-[12px] text-amber-900">
                <strong>The referral network is reachable.</strong>
                <span>Re-enter your PIN to send the work kept on this device.</span>
                <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    aria-label="PIN"
                    maxLength={6}
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-24 px-2 py-1 border border-amber-400 rounded bg-white font-mono"
                    placeholder="PIN"
                />
                <button type="submit" disabled={busy || pin.length < 4} className="px-3 py-1 rounded bg-[#1F3A6E] text-white font-bold disabled:opacity-50">
                    {busy ? 'Checking…' : 'Connect'}
                </button>
                {error && <span role="alert" className="text-red-700 font-semibold">{error}</span>}
            </form>
        </div>
    );
}
