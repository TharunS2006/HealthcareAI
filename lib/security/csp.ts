/**
 * The Content Security Policy, built from the same settings that decide where
 * the app connects (lib/socket.ts, lib/cloudEndpoint.ts), so it allows exactly
 * the relay, district service and assistant this build talks to.
 *
 * Shipped as a <meta> tag (app/layout.tsx) rather than only a response header,
 * because the same static build is served by Vercel, by a facility's own web
 * server and from inside the Android app — a header would protect one of them.
 * frame-ancestors cannot be set from a meta tag; vercel.json sends it.
 *
 * scripts/verify-csp.mts checks the policy.
 */

type Env = Record<string, string | undefined>;

function origin(url: string | undefined): string | null {
    if (!url?.trim()) return null;
    try {
        return new URL(url.trim()).origin;
    } catch {
        return null;
    }
}

/** An http(s) origin and its websocket twin — socket.io upgrades to ws(s) on the same host. */
function withSocket(o: string): string[] {
    return [o, o.replace(/^http/, 'ws')];
}

export function contentSecurityPolicy(env: Env): string {
    const relay = origin(env.NEXT_PUBLIC_MESH_URL);
    const reporting = origin(env.NEXT_PUBLIC_REPORTING_URL);
    const chat = origin(env.NEXT_PUBLIC_CHAT_URL);

    // Unset, the app finds its relay and district service on the host that
    // served it, on ports 3001 and 8000 — a facility LAN build. A policy cannot
    // name "this host, another port" before it knows the host, so connections
    // stay open for that build; scripts, frames and objects stay locked.
    const connect = relay && reporting
        ? ["'self'", ...withSocket(relay), reporting, ...(chat ? [chat] : [])]
        : ["'self'", 'http:', 'https:', 'ws:', 'wss:'];

    const directives: Record<string, string[]> = {
        'default-src': ["'self'"],
        // Next's static export bootstraps with inline scripts; a static build
        // cannot carry per-request nonces. No 'unsafe-eval'.
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        // No third-party images: nothing on any page is loaded from another origin.
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': [...new Set(connect)],
        'media-src': ["'self'", 'blob:'],
        'worker-src': ["'self'", 'blob:'],
        'manifest-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
    };
    return Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}
