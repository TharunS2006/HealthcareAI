/**
 * Inactivity lock — covers the screen of a signed-in session nobody is using.
 *
 * The clock is in lib/auth/idleLock.ts. When it runs out, the session is
 * marked locked (stores/authStore.ts) and this component draws an opaque,
 * full-screen PIN prompt above everything, toasts included, and makes the page
 * underneath inert so neither the keyboard nor a screen reader can reach it.
 * The page is not unmounted: a half-filled OPD form is still there after the
 * unlock. Referral sync carries on underneath, and an Emergency alert still
 * sounds; the lock screen shows only how many alerts are waiting, never whose.
 *
 * Only the signed-in user can unlock (lib/auth/signIn.ts unlockWithPin). Five
 * wrong PINs here sign the session out entirely, on top of the relay's and the
 * device's own lockouts.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useDirectoryStore } from '@/stores/directoryStore';
import { useLanguageStore } from '@/stores/languageStore';
import { useReferralStore } from '@/stores/referralStore';
import { ROLE_LABELS } from '@/lib/auth/permissions';
import { unlockWithPin } from '@/lib/auth/signIn';
import {
    IDLE_LOCK_MS,
    IDLE_RESUME_EVENT,
    idleLockMinutes,
    idleLockPaused,
    isIdle,
    markActive,
    readLastActive,
    resetIdleClock,
} from '@/lib/auth/idleLock';

const MAX_UNLOCK_FAILURES = 5;
const CHECK_EVERY_MS = 15_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;
const LOCK_ROOT_ID = 'nalammesh-session-lock';

export default function SessionLock() {
    const session = useAuthStore(s => s.session);
    const lock = useAuthStore(s => s.lock);
    const unlock = useAuthStore(s => s.unlock);
    const setToken = useAuthStore(s => s.setToken);
    const logout = useAuthStore(s => s.logout);
    const language = useLanguageStore(s => s.language);
    const waitingAlerts = useReferralStore(s =>
        session ? s.notifications.filter(n => n.recipient_user_id === session.userId && !n.is_read).length : 0
    );
    const router = useRouter();

    const [pin, setPin] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const failures = useRef(0);
    const pinInput = useRef<HTMLInputElement>(null);

    const userId = session?.userId ?? null;
    const locked = Boolean(session?.locked);

    // ── the clock ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!userId || locked || IDLE_LOCK_MS <= 0) return;

        const check = () => {
            if (!idleLockPaused() && isIdle(readLastActive(), Date.now())) lock();
        };
        // A reload, or a phone waking from sleep, may already be past the limit.
        if (readLastActive() === 0) resetIdleClock();
        else check();

        const onActivity = () => markActive();
        const onVisible = () => {
            if (document.visibilityState === 'visible') check();
        };
        for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { capture: true, passive: true });
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener(IDLE_RESUME_EVENT, check);
        const timer = window.setInterval(check, CHECK_EVERY_MS);
        return () => {
            for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity, { capture: true });
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener(IDLE_RESUME_EVENT, check);
            window.clearInterval(timer);
        };
    }, [userId, locked, lock]);

    // ── keep the page underneath out of reach while locked ─────────────────
    useEffect(() => {
        if (!locked) return;
        const touched = new Set<Element>();
        const shut = () => {
            for (const child of Array.from(document.body.children)) {
                if (child.id === LOCK_ROOT_ID || child.hasAttribute('inert')) continue;
                child.setAttribute('inert', '');
                touched.add(child);
            }
        };
        shut();
        // Toasts and dialogs mounted after the lock get the same treatment.
        const observer = new MutationObserver(shut);
        observer.observe(document.body, { childList: true });
        setTimeout(() => pinInput.current?.focus(), 0);
        return () => {
            observer.disconnect();
            touched.forEach(el => el.removeAttribute('inert'));
        };
    }, [locked]);

    useEffect(() => {
        if (!locked) {
            setPin('');
            setError(null);
            failures.current = 0;
        }
    }, [locked]);

    const signOut = useCallback(() => {
        logout();
        router.replace('/staff/login');
    }, [logout, router]);

    if (!session || !locked) return null;

    const isEn = language === 'en';
    const isHi = language === 'hi';
    const minutes = idleLockMinutes();
    const t = {
        title: isEn ? 'Session locked' : isHi ? 'सत्र लॉक है' : 'सत्र लॉक आहे',
        why: isEn
            ? `Locked after ${minutes} minutes without use. Patient information stays hidden until you re-enter your PIN.`
            : isHi
                ? `${minutes} मिनट तक उपयोग न होने पर लॉक हुआ। PIN दोबारा डालने तक मरीज़ों की जानकारी छिपी रहेगी।`
                : `${minutes} मिनिटे वापर न झाल्याने लॉक झाले. PIN पुन्हा टाकेपर्यंत रुग्णांची माहिती लपलेली राहील.`,
        pin: isEn ? 'PIN' : isHi ? 'पिन' : 'पिन',
        unlock: isEn ? 'Unlock' : isHi ? 'अनलॉक करें' : 'अनलॉक करा',
        checking: isEn ? 'Checking…' : isHi ? 'जाँच हो रही है…' : 'तपासत आहे…',
        notYou: isEn ? 'Not you? Sign out' : isHi ? 'आप नहीं हैं? साइन आउट करें' : 'तुम्ही नाही? साइन आउट करा',
        alerts: (n: number) => isEn
            ? `${n} referral alert${n === 1 ? '' : 's'} waiting — unlock to view.`
            : isHi
                ? `${n} रेफरल सूचना प्रतीक्षा में — देखने के लिए अनलॉक करें।`
                : `${n} संदर्भ सूचना प्रतीक्षेत — पाहण्यासाठी अनलॉक करा.`,
        tooMany: isEn ? 'Too many wrong PINs — signed out.' : isHi ? 'बहुत अधिक गलत PIN — साइन आउट किया गया।' : 'खूप चुकीचे PIN — साइन आउट केले.',
    };

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError(null);
        const directory = useDirectoryStore.getState();
        if (!directory.loaded) await directory.load();
        const deviceCopy = useDirectoryStore.getState().users.find(u => u.id === session.userId);
        const result = await unlockWithPin(session.userId, pin, deviceCopy);
        setBusy(false);
        setPin('');
        if (result.ok) {
            if (result.mode === 'NETWORK') setToken(result.token, result.expiresAt);
            unlock();
            return;
        }
        failures.current += 1;
        if (failures.current >= MAX_UNLOCK_FAILURES) {
            setError(t.tooMany);
            signOut();
            return;
        }
        setError(result.message);
        pinInput.current?.focus();
    };

    return (
        <div
            id={LOCK_ROOT_ID}
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-lock-title"
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0F1F3D] px-4"
        >
            <form onSubmit={submit} className="w-full max-w-sm rounded border border-[#B9C5D6] bg-white p-6 shadow-2xl">
                <h2 id="session-lock-title" className="text-lg font-bold text-[#1F3A6E]">{t.title}</h2>
                <p className="mt-1 text-[0.8125rem] leading-snug text-slate-600">{t.why}</p>
                <p className="mt-4 rounded bg-[#F4F6FA] px-3 py-2 text-[0.8125rem] text-[#0F172A]">
                    <span className="font-semibold">{session.name}</span>
                    {' · '}
                    {ROLE_LABELS[session.role] ?? session.role}
                    {session.facilityName ? ` · ${session.facilityName}` : ''}
                </p>
                {waitingAlerts > 0 && (
                    <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[0.8125rem] font-semibold text-red-800" role="status">
                        {t.alerts(waitingAlerts)}
                    </p>
                )}
                <label htmlFor="session-lock-pin" className="mt-4 block text-[0.75rem] font-semibold text-slate-700">{t.pin}</label>
                <input
                    ref={pinInput}
                    id="session-lock-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="current-password"
                    maxLength={6}
                    value={pin}
                    // Read-only while a PIN is being checked: the field is cleared
                    // when the answer comes, so typing meanwhile would be lost.
                    readOnly={busy}
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                    className="mt-1 w-full rounded border border-slate-400 px-3 py-2 font-mono text-lg tracking-widest focus:border-[#1F3A6E] focus:outline-none focus:ring-1 focus:ring-[#1F3A6E]"
                />
                {error && <p role="alert" className="mt-2 text-[0.8125rem] font-semibold text-red-700">{error}</p>}
                <button
                    type="submit"
                    disabled={busy || pin.length < 4}
                    className="mt-4 w-full rounded bg-[#1F3A6E] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#162B52] disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                    {busy ? t.checking : t.unlock}
                </button>
                <button
                    type="button"
                    onClick={signOut}
                    className="mt-2 w-full rounded px-4 py-2 text-[0.8125rem] font-semibold text-[#1F3A6E] underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-[#1F3A6E]"
                >
                    {t.notYou}
                </button>
            </form>
        </div>
    );
}
