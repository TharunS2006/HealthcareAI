/**
 * Where the district cloud service lives.
 *
 * Two features now depend on this address — the assistant's cloud fallback and
 * the patient-record outbox — so it is resolved in one place rather than
 * guessed twice. Mirrors the NEXT_PUBLIC_MESH_URL pattern in lib/socket.ts;
 * see .env.example.
 *
 * Nothing here implies the service is reachable. Every caller must work when it
 * is not: this app's whole premise is that connectivity is the exception.
 */
export function reportingBaseUrl(): string {
    const configured = process.env.NEXT_PUBLIC_REPORTING_URL?.trim();
    if (configured) return configured.replace(/\/+$/, '');

    if (typeof window !== 'undefined') {
        const host = window.location.hostname;
        const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '';
        if (!isLoopback) return `http://${host}:8000`;
    }
    return 'http://localhost:8000';
}
