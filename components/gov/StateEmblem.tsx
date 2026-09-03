/**
 * StateEmblem — Official State Emblem of India (Lion Capital of Ashoka)
 * Government of India & Government of Maharashtra Standard
 */

interface StateEmblemProps {
    className?: string;
    size?: number;
    light?: boolean;
}

export default function StateEmblem({ className = '', size = 48, light = false }: StateEmblemProps) {
    const strokeColor = light ? '#FFFFFF' : '#1F3A6E';
    const goldColor = light ? '#FDE047' : '#B45309';

    return (
        <div className={`inline-flex flex-col items-center select-none ${className}`} title="National Emblem of India • सत्यमेव जयते">
            <svg
                width={size}
                height={Math.round(size * 1.18)}
                viewBox="0 0 100 118"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="overflow-visible"
            >
                {/* Ashoka Lion Silhouette Representation */}
                {/* Central Lion Head */}
                <path
                    d="M50 4 C44 4 39 8 38 14 C36 12 33 11 30 13 C26 15 25 20 27 24 C24 26 23 30 25 34 C27 38 31 40 35 41 C36 45 39 48 43 50 L43 56 C38 58 35 62 35 67 L65 67 C65 62 62 58 57 56 L57 50 C61 48 64 45 65 41 C69 40 73 38 75 34 C77 30 76 26 73 24 C75 20 74 15 70 13 C67 11 64 12 62 14 C61 8 56 4 50 4 Z"
                    fill={strokeColor}
                />

                {/* Left Profile Lion */}
                <path
                    d="M26 28 C21 28 17 32 16 37 C14 36 12 36 10 38 C7 40 7 45 9 48 C6 50 5 54 7 57 C9 60 13 62 16 62 L28 58 C29 53 28 47 28 42 Z"
                    fill={strokeColor}
                    opacity="0.85"
                />

                {/* Right Profile Lion */}
                <path
                    d="M74 28 C79 28 83 32 84 37 C86 36 88 36 90 38 C93 40 93 45 91 48 C94 50 95 54 93 57 C91 60 87 62 84 62 L72 58 C71 53 72 47 72 42 Z"
                    fill={strokeColor}
                    opacity="0.85"
                />

                {/* Abacus / Pedestal */}
                <rect x="20" y="69" width="60" height="12" rx="2" fill={goldColor} />
                
                {/* Ashoka Chakra in Center of Abacus */}
                <circle cx="50" cy="75" r="4.5" fill="none" stroke="#FFFFFF" strokeWidth="1" />
                <circle cx="50" cy="75" r="1.5" fill="#FFFFFF" />
                {/* Spokes */}
                <path d="M50 71 L50 79 M46 75 L54 75 M47.2 72.2 L52.8 77.8 M47.2 77.8 L52.8 72.2" stroke="#FFFFFF" strokeWidth="0.7" />

                {/* Galloping Horse (Left) & Bull (Right) representations */}
                <ellipse cx="32" cy="75" rx="3.5" ry="2" fill="#FFFFFF" opacity="0.8" />
                <ellipse cx="68" cy="75" rx="3.5" ry="2.5" fill="#FFFFFF" opacity="0.8" />

                {/* Lower Lotus Base */}
                <path
                    d="M25 83 C35 88 65 88 75 83 L78 88 C66 93 34 93 22 88 Z"
                    fill={strokeColor}
                />

                {/* Motto Banner: सत्यमेव जयते */}
                <rect x="15" y="96" width="70" height="14" rx="1" fill={light ? '#FFFFFF' : '#1F3A6E'} />
                <text
                    x="50"
                    y="106"
                    textAnchor="middle"
                    fill={light ? '#1F3A6E' : '#FFFFFF'}
                    fontSize="7"
                    fontWeight="bold"
                    fontFamily="serif"
                    letterSpacing="1.2"
                >
                    सत्यमेव जयते
                </text>
            </svg>
        </div>
    );
}
