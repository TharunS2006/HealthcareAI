/**
 * Language Store — Official Portal Languages
 * Marathi (mr) • Hindi (hi) • English (en)
 *
 * Only languages with a complete dictionary in lib/i18n.ts may be listed here.
 * Adding a code without a dictionary makes t() silently fall back to Marathi.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'en' | 'mr' | 'hi';

export const SUPPORTED_LANGUAGES: readonly Language[] = ['en', 'mr', 'hi'] as const;

const DEFAULT_LANGUAGE: Language = 'en';

function normalizeLanguage(value: unknown): Language {
    return SUPPORTED_LANGUAGES.includes(value as Language) ? (value as Language) : DEFAULT_LANGUAGE;
}

interface LanguageState {
    language: Language;
    setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            language: DEFAULT_LANGUAGE,
            setLanguage: (language: Language) => set({ language: normalizeLanguage(language) }),
        }),
        {
            name: 'nalammesh-language-v2',
            version: 2,
            /**
             * Devices that used the earlier 6-language build have 'ta' | 'te' | 'bn'
             * persisted in localStorage. Those dictionaries no longer exist, so coerce
             * any unknown code back to the default instead of rehydrating a dead value.
             */
            migrate: (persisted) => ({
                language: normalizeLanguage((persisted as LanguageState | undefined)?.language),
            }),
            merge: (persisted, current) => ({
                ...current,
                ...(persisted as Partial<LanguageState>),
                language: normalizeLanguage((persisted as LanguageState | undefined)?.language),
            }),
        }
    )
);
