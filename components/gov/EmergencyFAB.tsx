/**
 * EmergencyFAB — Floating red emergency button visible on EVERY screen.
 * One-tap emergency escalation (M13).
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function EmergencyFAB() {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-50 emergency-fab">
            {expanded && (
                <div className="mb-3 bg-white rounded-lg shadow-elevated border border-gov-red/20 p-4 w-72 animate-fade-in">
                    <h3 className="text-sm font-bold text-gov-red mb-2">Emergency Escalation</h3>
                    <p className="text-xs text-txt-secondary mb-3">
                        This will send an emergency alert with your health summary to the nearest higher-tier facility.
                    </p>
                    <div className="space-y-2">
                        <a
                            href="tel:108"
                            className="gov-btn gov-btn-danger w-full text-sm"
                        >
                            🚑 Call 108 Ambulance
                        </a>
                        <a
                            href="tel:102"
                            className="gov-btn gov-btn-danger w-full text-sm"
                        >
                            🤰 Call 102 Maternal
                        </a>
                        <Link
                            href="/emergency"
                            className="gov-btn gov-btn-secondary w-full text-sm"
                            onClick={() => setExpanded(false)}
                        >
                            Send Digital Alert
                        </Link>
                    </div>
                    <button
                        onClick={() => setExpanded(false)}
                        className="mt-2 text-xs text-txt-muted hover:text-txt-secondary w-full text-center"
                    >
                        Cancel
                    </button>
                </div>
            )}

            <button
                onClick={() => setExpanded(!expanded)}
                className="w-14 h-14 rounded-full bg-gov-red text-white shadow-elevated hover:bg-red-800 transition-all flex items-center justify-center text-2xl"
                aria-label="Emergency help — call 108, 102, or send digital alert"
                title="Emergency"
            >
                {expanded ? '✕' : '🆘'}
            </button>
        </div>
    );
}
