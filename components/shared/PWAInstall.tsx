/**
 * PWAInstall — Service Worker registration + "Install App" prompt
 * Government of Maharashtra • Public Health Department • NHM
 *
 * This component is the ONLY place navigator.serviceWorker.register() is called.
 * It must stay mounted in app/layout.tsx or offline support silently stops working.
 */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguageStore } from '@/stores/languageStore';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'nalammesh-install-dismissed';

export default function PWAInstall() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = useState(false);
    const { language } = useLanguageStore();

    const isEn = language === 'en';
    const isHi = language === 'hi';

    useEffect(() => {
        // ---- Service Worker registration (offline-first app shell) ----
        if ('serviceWorker' in navigator) {
            if (process.env.NODE_ENV === 'production') {
                navigator.serviceWorker
                    .register('/sw.js')
                    .then((reg) => {
                        console.log('[PWA] Service worker registered:', reg.scope);
                        // Activate a waiting update immediately so offline assets stay current.
                        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
                    })
                    .catch((err) => console.warn('[PWA] SW registration failed:', err));
            } else {
                // In dev, Next.js serves un-hashed HMR chunks; caching them breaks fast refresh.
                console.info('[PWA] Service worker registration skipped in development. Run `npm run build` to test offline mode.');
            }
        }

        // Already installed as a standalone app — nothing to prompt.
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        if (localStorage.getItem(DISMISS_KEY) === 'true') return;

        const handler = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e as BeforeInstallPromptEvent);
            setShowBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!installPrompt) return;

        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;

        if (outcome === 'accepted') setShowBanner(false);
        setInstallPrompt(null);
    };

    const dismiss = () => {
        localStorage.setItem(DISMISS_KEY, 'true');
        setShowBanner(false);
    };

    if (!showBanner) return null;

    const label = isEn ? 'Install NalamMesh' : isHi ? 'ऐप इंस्टॉल करें' : 'अ‍ॅप इंस्टॉल करा';
    const sub = isEn ? 'Works fully offline' : isHi ? 'पूर्णतः ऑफलाइन कार्य करता है' : 'पूर्णपणे ऑफलाइन चालते';
    const later = isEn ? 'Later' : isHi ? 'बाद में' : 'नंतर';
    const install = isEn ? 'Install' : isHi ? 'इंस्टॉल' : 'इंस्टॉल';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                // Anchored bottom-LEFT: the emergency SOS control owns bottom-right and must never be covered.
                className="fixed bottom-4 left-4 z-[60] bg-white border border-slate-300 rounded-lg shadow-lg p-3.5 flex items-center gap-3 max-w-[330px]"
                role="dialog"
                aria-label={label}
            >
                <div className="w-9 h-9 bg-[#1F3A6E] rounded flex items-center justify-center text-white shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1F3A6E] text-sm leading-tight">{label}</p>
                    <p className="text-[11px] text-slate-500 leading-tight">{sub}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                    <button
                        onClick={dismiss}
                        className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1 cursor-pointer"
                    >
                        {later}
                    </button>
                    <button
                        onClick={handleInstall}
                        className="bg-[#1F3A6E] text-white text-[11px] font-bold px-3 py-1.5 rounded hover:bg-[#16294E] transition-colors cursor-pointer"
                    >
                        {install}
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
