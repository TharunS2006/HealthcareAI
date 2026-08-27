/**
 * Language Store — Multi-Language Support (English, Marathi मराठी, Hindi हिन्दी)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Language = 'en' | 'mr' | 'hi';

interface LanguageState {
    language: Language;
    setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            language: 'mr', // Default to Marathi for Maharashtra SIH PS
            setLanguage: (language: Language) => set({ language }),
        }),
        {
            name: 'nalammesh-language-v2',
        }
    )
);
