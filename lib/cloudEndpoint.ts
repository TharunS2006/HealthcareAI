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

/**
 * Where the cloud assistant lives.
 *
 * Separate from reportingBaseUrl() because the two services stopped sharing an
 * address the moment one of them was deployed. The assistant holds nothing but
 * an API key, so it can sit on a public HTTPS URL — which it must, since a
 * browser refuses to let an HTTPS page call a plain-HTTP backend. The record
 * store holds identified patient data and has no authentication, so it stays on
 * the LAN.
 *
 * Defaults to the reporting address, so the single-machine demo — one FastAPI
 * process serving both — needs no configuration at all and behaves exactly as
 * it did before this split existed.
 */
export function chatBaseUrl(): string {
    const configured = process.env.NEXT_PUBLIC_CHAT_URL?.trim();
    if (configured) return configured.replace(/\/+$/, '');
    return reportingBaseUrl();
}
