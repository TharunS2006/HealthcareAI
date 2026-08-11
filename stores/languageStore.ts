/**
 * Language Store — Multi-Language Support (English, Tamil, Hindi)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'en' | 'ta' | 'hi';

interface LanguageState {
    language: Language;
    setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            language: 'en',
            setLanguage: (language: Language) => set({ language }),
        }),
        {
            name: 'nalammesh-language',
        }
    )
);
