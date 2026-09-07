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
                // Official Government of India & Maharashtra Color System
                gov: {
                    navy: '#1F3A6E',
                    'navy-dark': '#11223F',
                    'navy-light': '#284B8C',
                    'navy-hover': '#16294E',
                    saffron: '#FF9933',
                    'saffron-dark': '#B45309',
                    green: '#138808',
                    'green-dark': '#0D6E06',
                    'green-bg': '#E8F5E9',
                    'green-border': '#A5D6A7',
                    red: '#C53030',
                    'red-bg': '#FEF2F2',
                    amber: '#B45309',
                    'amber-bg': '#FFFBEB',
                    blue: '#1D4ED8',
                    'blue-bg': '#EFF6FF',
                    'blue-border': '#93C5FD',
                    success: '#15803D',
                    'success-bg': '#F0FDF4',
                    // Module accent hues — used only to differentiate service cards
                    'accent-sky': '#0284C7',
                    'accent-indigo': '#4F46E5',
                    'accent-teal': '#0D9488',
                    'accent-violet': '#7C3AED',
                    'accent-crimson': '#DC2626',
                },
                // Backward-compatible theme tokens mapped to official Gov colors
                emerald: {
                    deep: '#1F3A6E',   // Primary Gov Navy
                    dark: '#11223F',   // Dark Gov Header Navy
                    light: '#284B8C',  // Light Gov Navy
                },
                teal: {
                    accent: '#138808', // National Health Green
                    hover: '#0D6E06',
                    soft: '#F0FDF4',
                },
                // Status Colors (WCAG 2.1 AAA Compliant)
                status: {
                    red: '#C53030',
                    'red-bg': '#FEF2F2',
                    yellow: '#B45309',
                    'yellow-bg': '#FFFBEB',
                    green: '#15803D',
                    'green-bg': '#F0FDF4',
                },
                // Surfaces
                bg: {
                    page: '#F4F6FA',
                    surface: '#FFFFFF',
                    'surface-hover': '#F8FAFC',
                    sidebar: '#11223F',
                },
                // Text
                txt: {
                    primary: '#0F172A',
                    secondary: '#475569',
                    muted: '#64748B',
                    onDark: '#FFFFFF',
                    onDarkMuted: 'rgba(255, 255, 255, 0.85)',
                },
                // Borders
                border: {
                    subtle: '#CBD5E1',
                    active: '#94A3B8',
                },
            },
            fontFamily: {
                sans: ['Noto Sans', 'Noto Sans Devanagari', 'Arial', 'Helvetica', 'sans-serif'],
                mono: ['JetBrains Mono', 'Courier New', 'monospace'],
            },
            borderRadius: {
                DEFAULT: '4px',
                'sm': '2px',
                'md': '6px',
                'lg': '8px',
                'xl': '8px',
                '2xl': '8px',
                '3xl': '8px',
                'full': '9999px',
            },
            boxShadow: {
                'soft': '0 1px 3px rgba(0, 0, 0, 0.05)',
                'card': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)',
                'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            },
        },
    },
    plugins: [],
};

export default config;
