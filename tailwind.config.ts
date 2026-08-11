import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Modern Medcare Palette
                emerald: {
                    deep: '#0E4D45',   // Sidebar / Primary
                    dark: '#093630',
                    light: '#146E63',
                },
                teal: {
                    accent: '#2AA198', // Actions
                    hover: '#258E86',
                    soft: '#E6FFFA',   // Backgrounds
                },
                // Status - Professional
                status: {
                    red: '#E53E3E',
                    'red-bg': '#FFF5F5',
                    yellow: '#D69E2E',
                    'yellow-bg': '#FFFFF0',
                    green: '#38A169',
                    'green-bg': '#F0FFF4',
                },
                // Surface
                bg: {
                    page: '#F7F9FB',  // Light Blue-Grey
                    surface: '#FFFFFF',
                    sidebar: '#0E4D45',
                },
                // Text
                txt: {
                    primary: '#1A202C',  // Slate-900
                    secondary: '#718096', // Slate-500
                    muted: '#A0AEC0',    // Slate-400
                    onDark: '#FFFFFF',
                    onDarkMuted: 'rgba(255, 255, 255, 0.7)',
                },
                border: {
                    subtle: '#E2E8F0',
                    active: '#CBD5E0',
                },
            },
            fontFamily: {
                sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
                mono: ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
            },
            boxShadow: {
                'soft': '0 2px 10px rgba(0, 0, 0, 0.03)',
                'card': '0 4px 20px rgba(0, 0, 0, 0.05)',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'slide-up': 'slideUp 0.5s ease-out forwards',
                'slide-right': 'slideRight 0.3s ease-out forwards',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideRight: {
                    '0%': { opacity: '0', transform: 'translateX(-10px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
            },
        },
    },
    plugins: [],
};

export default config;
