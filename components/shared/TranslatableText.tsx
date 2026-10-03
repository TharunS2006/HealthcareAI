/**
 * Text with a "Translate (Bhashini)" control — for referral reasons, clinical
 * summaries and the messages between facilities, which are written by one
 * facility in its language and read by another in theirs.
 *
 * Shown only when the relay has Bhashini configured and the user is signed in
 * to the network. The translation is labelled as machine translation: it helps
 * a reader understand a note, it does not replace asking the sender.
 */

'use client';

import { useEffect, useState } from 'react';
import { useLanguageStore } from '@/stores/languageStore';
import { useAuthStore } from '@/stores/authStore';
import { bhashiniAvailable, guessLanguage, translate, type AppLanguage } from '@/lib/bhashini/client';

const NAMES: Record<AppLanguage, string> = { en: 'English', hi: 'हिन्दी (Hindi)', mr: 'मराठी (Marathi)' };

export default function TranslatableText({ text, className }: { text: string; className?: string }) {
    const { language } = useLanguageStore();
    const ui = (['en', 'hi', 'mr'].includes(language) ? language : 'en') as AppLanguage;
    const hasToken = useAuthStore(s => Boolean(s.session?.token));
    const [available, setAvailable] = useState(false);
    const [open, setOpen] = useState(false);
    const [source, setSource] = useState<AppLanguage>(() => guessLanguage(text, ui));
    const [target, setTarget] = useState<AppLanguage>(ui);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ text: string; target: AppLanguage } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (hasToken ? bhashiniAvailable() : Promise.resolve(false)).then(ok => { if (!cancelled) setAvailable(ok); });
        return () => { cancelled = true; };
    }, [hasToken]);

    // A reader's own language is the obvious target — unless the note is already in it.
    useEffect(() => {
        const guessed = guessLanguage(text, ui);
        setSource(guessed);
        setTarget(guessed === ui ? (ui === 'en' ? 'hi' : 'en') : ui);
        setResult(null);
    }, [text, ui]);

    const run = async () => {
        setBusy(true);
        setError(null);
        try {
            setResult({ text: await translate(text, source, target), target });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Translation failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={className}>
            <span>{text}</span>
            {available && (
                <div className="mt-0.5">
                    {!open ? (
                        <button type="button" onClick={() => setOpen(true)} className="text-[10px] font-bold text-[#1F3A6E] underline">
                            Translate (Bhashini)
                        </button>
                    ) : (
                        <div className="mt-1 p-1.5 border border-slate-200 bg-white text-[11px] space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <label className="flex items-center gap-1">
                                    Written in
                                    <select value={source} onChange={e => setSource(e.target.value as AppLanguage)} className="border border-slate-300 rounded px-1 py-0.5">
                                        {(Object.keys(NAMES) as AppLanguage[]).map(l => <option key={l} value={l}>{NAMES[l]}</option>)}
                                    </select>
                                </label>
                                <label className="flex items-center gap-1">
                                    to
                                    <select value={target} onChange={e => setTarget(e.target.value as AppLanguage)} className="border border-slate-300 rounded px-1 py-0.5">
                                        {(Object.keys(NAMES) as AppLanguage[]).filter(l => l !== source).map(l => <option key={l} value={l}>{NAMES[l]}</option>)}
                                    </select>
                                </label>
                                <button type="button" disabled={busy || source === target} onClick={() => void run()}
                                    className="px-2 py-0.5 rounded bg-[#1F3A6E] text-white font-bold disabled:opacity-50">
                                    {busy ? 'Translating…' : 'Translate'}
                                </button>
                                <button type="button" onClick={() => { setOpen(false); setResult(null); setError(null); }} className="text-slate-500 underline">Close</button>
                            </div>
                            {result && (
                                <p lang={result.target} className="text-slate-800">
                                    {result.text}
                                    <span className="block text-[10px] text-slate-500">Machine translation by Bhashini — check with the sender before acting on it.</span>
                                </p>
                            )}
                            {error && <p role="alert" className="text-red-700">{error}</p>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
