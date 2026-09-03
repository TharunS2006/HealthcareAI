/**
 * StateEmblem — Official State Emblem of India (Lion Capital of Ashoka)
 * Government of India & Government of Maharashtra Standard
 * Rendered according to the State Emblem of India (Prohibition of Improper Use) Act, 2005
 */

interface StateEmblemProps {
    className?: string;
    size?: number;
    light?: boolean;
}

export default function StateEmblem({ className = '', size = 44, light = false }: StateEmblemProps) {
    const primaryColor = light ? '#FFFFFF' : '#1F3A6E';
    const accentColor = light ? '#E2E8F0' : '#475569';
    const goldColor = light ? '#FDE047' : '#9A3412';

    return (
        <div
            className={`inline-flex flex-col items-center select-none ${className}`}
            title="State Emblem of India • भारत का राज्यचिन्ह • सत्यमेव जयते"
            role="img"
            aria-label="National Emblem of India"
        >
            <svg
                width={size}
                height={Math.round(size * 1.25)}
                viewBox="0 0 100 125"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="overflow-visible"
            >
                {/* --- LION HEADS (LION CAPITAL) --- */}
                {/* Central Lion Mane & Head */}
                <g fill={primaryColor}>
                    {/* Central Face Crown / Mane Top */}
                    <path d="M50 4C45 4 41 8 40 13C38 12 35 12 33 14C30 16 30 20 31 24C28 26 27 30 29 34C31 38 35 40 38 41C39 45 42 48 46 50L46 55C41 57 38 61 38 66L62 66C62 61 59 57 54 55L54 50C58 48 61 45 62 41C65 40 69 38 71 34C73 30 72 26 69 24C70 20 70 16 67 14C65 12 62 12 60 13C59 8 55 4 50 4Z" />
                    {/* Central Lion Snout & Whisker Details */}
                    <path d="M47 22H53V26C53 28 51.5 29 50 29C48.5 29 47 28 47 26V22Z" fill={light ? '#1F3A6E' : '#FFFFFF'} />
                    <circle cx="44" cy="18" r="1.5" fill={light ? '#1F3A6E' : '#FFFFFF'} />
                    <circle cx="56" cy="18" r="1.5" fill={light ? '#1F3A6E' : '#FFFFFF'} />

                    {/* Left Lion Profile */}
                    <path
                        d="M31 16C26 18 22 23 21 28C19 28 17 29 16 31C14 34 14 38 16 41C14 43 13 47 15 50C17 53 21 55 24 55L29 53C31 47 31 42 31 36Z"
                        opacity="0.9"
                    />
                    <circle cx="23" cy="27" r="1.2" fill={light ? '#1F3A6E' : '#FFFFFF'} />

                    {/* Right Lion Profile */}
                    <path
                        d="M69 16C74 18 78 23 79 28C81 28 83 29 84 31C86 34 86 38 84 41C86 43 87 47 85 50C83 53 79 55 76 55L71 53C69 47 69 42 69 36Z"
                        opacity="0.9"
                    />
                    <circle cx="77" cy="27" r="1.2" fill={light ? '#1F3A6E' : '#FFFFFF'} />
                </g>

                {/* --- ABACUS BASE --- */}
                {/* Upper Rim */}
                <rect x="18" y="67" width="64" height="3.5" rx="1" fill={accentColor} />
                
                {/* Abacus Center Frieze */}
                <rect x="20" y="70.5" width="60" height="11" rx="1" fill={goldColor} />

                {/* --- CENTRAL ASHOKA CHAKRA --- */}
                <circle cx="50" cy="76" r="4.8" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
                <circle cx="50" cy="76" r="1.3" fill="#FFFFFF" />
                {/* 8 representative spokes */}
                <path d="M50 71.5L50 80.5M45.5 76L54.5 76M46.8 72.8L53.2 79.2M46.8 79.2L53.2 72.8" stroke="#FFFFFF" strokeWidth="0.8" strokeLinecap="round" />

                {/* Galloping Horse (Left) */}
                <path
                    d="M28 73C30 73 33 74 34 76C33 78 30 78 28 78L26 79L27 76L25 75C26 74 27 73 28 73Z"
                    fill="#FFFFFF"
                    opacity="0.9"
                />

                {/* Standing Bull (Right) */}
                <path
                    d="M72 73C74 73 76 74 76 76C75 78 73 78 71 78L69 79L70 76L68 75C69 74 70 73 72 73Z"
                    fill="#FFFFFF"
                    opacity="0.9"
                />

                {/* Abacus Lower Rim */}
                <rect x="18" y="81.5" width="64" height="3" rx="1" fill={accentColor} />

                {/* --- BELL-SHAPED LOTUS BASE --- */}
                <path
                    d="M24 85C32 90 68 90 76 85C77 88 74 91 68 93C58 95 42 95 32 93C26 91 23 88 24 85Z"
                    fill={primaryColor}
                />

                {/* Lotus Petal Fluting Accents */}
                <path d="M38 87C40 91 42 93 44 94M50 87V94M62 87C60 91 58 93 56 94" stroke={light ? '#1F3A6E' : '#FFFFFF'} strokeWidth="0.8" opacity="0.4" />

                {/* --- MOTTO BANNER: सत्यमेव जयते --- */}
                <rect x="12" y="99" width="76" height="15" rx="2" fill={light ? '#FFFFFF' : '#1F3A6E'} stroke={light ? '#CBD5E1' : '#B45309'} strokeWidth="1" />
                <text
                    x="50"
                    y="110"
                    textAnchor="middle"
                    fill={light ? '#1F3A6E' : '#FFFFFF'}
                    fontSize="7.5"
                    fontWeight="800"
                    fontFamily="serif"
                    letterSpacing="0.8"
                >
                    सत्यमेव जयते
                </text>
            </svg>
        </div>
    );
}
