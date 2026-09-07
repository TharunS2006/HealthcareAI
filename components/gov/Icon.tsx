/**
 * Flat monochrome icon set — Government of Maharashtra digital properties do not use
 * pictographic emoji as UI iconography (rendering varies by OS/browser and reads as
 * informal). Every icon here is a single-color stroke outline, same convention as the
 * icons already used in components/shared/Sidebar.tsx.
 *
 * Usage: <Icon name="ambulance" className="w-4 h-4" />
 */

'use client';

export type IconName =
    | 'mic'
    | 'search'
    | 'printer'
    | 'download'
    | 'upload'
    | 'clipboard'
    | 'sms'
    | 'maternal'
    | 'child'
    | 'stethoscope'
    | 'target'
    | 'map-pin'
    | 'clinician'
    | 'ambulance'
    | 'check-circle'
    | 'alert-siren'
    | 'phone'
    | 'warning'
    | 'flask'
    | 'pill'
    | 'ticket'
    | 'hospital'
    | 'chart-bar'
    | 'tv'
    | 'megaphone'
    | 'bolt'
    | 'signal'
    | 'community-worker'
    | 'mic-off'
    | 'video'
    | 'video-off'
    | 'archive-box'
    | 'government'
    | 'document'
    | 'rocket'
    | 'edit'
    | 'record-dot';

const PATHS: Record<IconName, React.ReactNode> = {
    mic: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a4.5 4.5 0 004.5-4.5V6a4.5 4.5 0 10-9 0v8.25a4.5 4.5 0 004.5 4.5zM19.5 10.5v2.25a7.5 7.5 0 01-15 0V10.5M12 21v-3" />
    ),
    'mic-off': (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M9 9v5.25a3 3 0 004.83 2.38M15 6v-.75a3 3 0 00-5.86-.93M19.5 10.5v2.25c0 1.02-.2 1.99-.57 2.88M12 18.75v2.25m-3.75 0h7.5" />
    ),
    search: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
    ),
    printer: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0M6.72 13.829a42.815 42.815 0 00-1.222 3.865M18 13.829c.24.03.48.062.72.096m-.72-.096a42.415 42.415 0 00-10.56 0m11.28.096a42.815 42.815 0 011.222 3.865M6 18h12v3H6v-3zM6 7.5h12M6 3.75h12a1.5 1.5 0 011.5 1.5v6.75a1.5 1.5 0 01-1.5 1.5H6a1.5 1.5 0 01-1.5-1.5V5.25A1.5 1.5 0 016 3.75z" />
    ),
    download: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 12l4.5 4.5m0 0l4.5-4.5m-4.5 4.5V3" />
    ),
    upload: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 7.5L12 3m0 0L7.5 7.5M12 3v13.5" />
    ),
    clipboard: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h2.153a1 1 0 01.894.553l.5 1A1 1 0 0011.447 5h1.106a1 1 0 00.9-.447l.5-1A1 1 0 0114.847 3H17a2 2 0 012 2v14a2 2 0 01-2 2z" />
    ),
    sms: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm3.75 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    ),
    maternal: (
        <>
            <circle cx="12" cy="5.5" r="2.25" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 21v-5.5c0-1 .4-1.9 1.1-2.55C8.6 12.1 8 11.05 8 9.85 8 7.72 9.79 6 12 6s4 1.72 4 3.85c0 1.2-.6 2.25-1.6 2.95.7.65 1.1 1.55 1.1 2.55V21" />
        </>
    ),
    child: (
        <>
            <circle cx="12" cy="6" r="2" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 21v-4.5c0-1.7 1.34-3 3-3s3 1.3 3 3V21M9.5 13l-2-3M14.5 13l2-3" />
        </>
    ),
    stethoscope: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5v4.86a4.5 4.5 0 004.5 4.5v0a4.5 4.5 0 004.5-4.5V4.5M6 4.5h4.5M15.75 4.5h4.5M12.75 13.86V16.5a4.5 4.5 0 104.5-4.5h-.75M18.75 15.75a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0z" />
    ),
    target: (
        <>
            <circle cx="12" cy="12" r="8.25" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="4.25" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="12" r=".75" strokeLinecap="round" strokeLinejoin="round" fill="currentColor" />
        </>
    ),
    'map-pin': (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    ),
    clinician: (
        <>
            <circle cx="12" cy="7.5" r="3" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20.25a7.5 7.5 0 0115 0M14.25 3.75l1.5 1.5-1.5 1.5m3.75-1.5H12" />
        </>
    ),
    'community-worker': (
        <>
            <circle cx="12" cy="7.5" r="3" strokeLinecap="round" strokeLinejoin="round" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 20.25a7.5 7.5 0 0115 0M9 3.75L7.5 6M15 3.75L16.5 6" />
        </>
    ),
    ambulance: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V8.25A1.5 1.5 0 014.5 6.75h9a1.5 1.5 0 011.5 1.5v1.5h2.379a1.5 1.5 0 011.06.44l1.622 1.62a1.5 1.5 0 01.439 1.061v3.129a1.5 1.5 0 01-1.5 1.5H18M15 16.5H9M3 16.5a1.5 1.5 0 003 0M3 16.5H1.5M18 16.5a1.5 1.5 0 003 0M9 16.5a1.5 1.5 0 01-3 0M7.5 9.75v3m-1.5-1.5h3" />
    ),
    'check-circle': (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l2.25 2.25L15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
    'alert-siren': (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-1.5 0-2.75 1.15-2.75 2.6v1.4h5.5v-1.4c0-1.45-1.25-2.6-2.75-2.6zM6 15.75V12A6 6 0 0112 6v0a6 6 0 016 6v3.75M4.5 15.75h15v2.25a1.5 1.5 0 01-1.5 1.5h-12a1.5 1.5 0 01-1.5-1.5v-2.25zM10.5 21.75h3" />
    ),
    phone: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h1.5a2.25 2.25 0 002.25-2.25v-1.372a1.5 1.5 0 00-1.5-1.5l-3.375-.001a1.5 1.5 0 00-1.396.953l-.375.938a13.42 13.42 0 01-6.364-6.364l.938-.375a1.5 1.5 0 00.953-1.396L9.622 6.5a1.5 1.5 0 00-1.5-1.5H6.75A2.25 2.25 0 004.5 7.25v-.5z" />
    ),
    warning: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.008v.008H12v-.008zM10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78a1.5 1.5 0 001.29-2.25L13.71 3.86a1.5 1.5 0 00-2.42 0z" />
    ),
    flask: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5.5 14a2.25 2.25 0 00-.659 1.591v2.909A2.25 2.25 0 007.09 21h9.82a2.25 2.25 0 002.25-2.25v-2.909A2.25 2.25 0 0018.5 14l-3.591-3.591a2.25 2.25 0 01-.659-1.591V3.104M6.75 3h10.5M8.25 12h7.5" />
    ),
    pill: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l7.5-7.5a4.243 4.243 0 116 6l-7.5 7.5a4.243 4.243 0 11-6-6zM9.75 8.25l6 6" />
    ),
    ticket: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6H21v3a1.5 1.5 0 000 3v3h-4.5M16.5 6H3v3a1.5 1.5 0 010 3v3h13.5M16.5 6v12" />
    ),
    hospital: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5.25 21V6a1.5 1.5 0 011.5-1.5h10.5a1.5 1.5 0 011.5 1.5v15M9.75 8.25h4.5M12 6v4.5M9 21v-4.5a1.5 1.5 0 011.5-1.5h3a1.5 1.5 0 011.5 1.5V21" />
    ),
    'chart-bar': (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5h3.75V21H3v-7.5zM10.125 8.25h3.75V21h-3.75V8.25zM17.25 3.75H21V21h-3.75V3.75z" />
    ),
    tv: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5A1.5 1.5 0 0121.75 6.75v9a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5v-9a1.5 1.5 0 011.5-1.5zM8.25 21h7.5" />
    ),
    megaphone: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18a23.848 23.848 0 004.365 3.605 1.04 1.04 0 001.635-.86V4.11a1.04 1.04 0 00-1.635-.86 23.848 23.848 0 01-4.365 3.605m0 9.18V6.855M3 10.5v3" />
    ),
    bolt: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    ),
    signal: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.808-3.807 9.98-3.807 13.788 0M2.25 8.674c5.385-5.386 14.115-5.386 19.5 0M12 18.75h.008v.008H12v-.008z" />
    ),
    video: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a1.5 1.5 0 001.5-1.5v-9a1.5 1.5 0 00-1.5-1.5h-9a1.5 1.5 0 00-1.5 1.5v9a1.5 1.5 0 001.5 1.5z" />
    ),
    'video-off': (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-.177.483M4.5 6.01A1.5 1.5 0 003 7.5v9a1.5 1.5 0 001.5 1.5h9c.354 0 .674-.117.934-.31" />
    ),
    'archive-box': (
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    ),
    government: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 21V9.75M19.5 21V9.75M2.25 9.75L12 3l9.75 6.75M7.5 21v-6.75h3V21m3 0v-6.75h3V21" />
    ),
    document: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-1.519-3.02l-1.06-2.548a1.125 1.125 0 00-2.078 0l-1.06 2.548M9.75 17.25h4.5M6.75 21h10.5a2.25 2.25 0 002.25-2.25V7.5L15 2.25H6.75A2.25 2.25 0 004.5 4.5v14.25A2.25 2.25 0 006.75 21z" />
    ),
    rocket: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.83m5.96 5.54a6 6 0 01-7.38 5.84H8.4m6.19-6.19c-1.31 0-2.6.16-3.86.46m0 0A14.98 14.98 0 002.6 9.83m5.83 5.87L2.6 21.4m5.83-5.7c-.94.28-1.84.68-2.68 1.19" />
    ),
    edit: (
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zM19.5 19.5H4.5" />
    ),
    'record-dot': (
        <circle cx="12" cy="12" r="6" fill="currentColor" />
    ),
};

export default function Icon({
    name,
    className = 'w-4 h-4 flex-shrink-0',
    ...rest
}: { name: IconName; className?: string } & React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            className={className}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
            aria-hidden="true"
            {...rest}
        >
            {PATHS[name]}
        </svg>
    );
}
