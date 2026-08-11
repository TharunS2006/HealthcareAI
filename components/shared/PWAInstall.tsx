/**
 * PWA Install Prompt & Service Worker Registration
 * Shows "Install App" banner when the browser supports it
 */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstall() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/sw.js')
                .then((reg) => console.log('[PWA] Service worker registered:', reg.scope))
                .catch((err) => console.warn('[PWA] SW registration failed:', err));
        }

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }

        // Listen for install prompt
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

        if (outcome === 'accepted') {
            setIsInstalled(true);
            setShowBanner(false);
        }
        setInstallPrompt(null);
    };

    if (isInstalled || !showBanner) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-4 right-4 md:right-6 z-[9999] bg-white border border-border-subtle rounded-xl shadow-lg p-3.5 flex items-center gap-3 max-w-[320px]"
            >
                <div className="w-9 h-9 bg-emerald-deep rounded-lg flex items-center justify-center text-white shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-emerald-deep text-sm leading-tight">Install App</p>
                    <p className="text-[11px] text-txt-muted leading-tight">Works offline</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                    <button
                        onClick={() => setShowBanner(false)}
                        className="text-[11px] text-txt-muted hover:text-txt-secondary px-2 py-1"
                    >
                        Later
                    </button>
                    <button
                        onClick={handleInstall}
                        className="bg-emerald-deep text-white text-[11px] font-semibold px-3 py-1 rounded-md hover:bg-emerald-800 transition-colors"
                    >
                        Install
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
