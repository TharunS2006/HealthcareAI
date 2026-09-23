/**
 * NalamMesh Assistant — cloud client (Layer 2).
 *
 * Calls the district reporting service's /api/v1/chat endpoint, which relays the
 * question plus a grounding brief to whichever model that service has a key for
 * (Groq, Grok or Claude — it reports back which one answered). This is strictly
 * a fallback: Layer 1 (lib/chat/retrieve.ts) answers offline from real app data,
 * and this path only runs when Layer 1 finds no confident match, the question is
 * inside the assistant's declared scope (lib/chat/scopeGuard.ts), AND the device
 * is online.
 *
 * Nothing here may block care. Every failure — no backend configured, no API key
 * on the server, network down, request timed out — resolves to a null answer with
 * a reason the widget can show, never a thrown error that breaks the page.
 */

import type { Language } from '@/stores/languageStore';
import { reportingBaseUrl } from '@/lib/cloudEndpoint';
import { buildGroundingBrief } from './groundingBrief';
import { isInScope } from './scopeGuard';

export interface CloudResult {
    answer: string | null;
    /** Why there is no answer. Shown to the worker so a silent blank never happens. */
    reason?: 'out-of-scope' | 'offline' | 'not-configured' | 'unreachable' | 'timeout' | 'error';
    model?: string;
}

// The address moved to lib/cloudEndpoint.ts once the record outbox needed it too.
// Re-exported here so existing importers of this module keep working.
export { reportingBaseUrl };

// Longer than a page fetch should ever be, deliberately. Layer 1 answers every
// clinical question offline and instantly, so nothing at a bedside is waiting on
// this call — what waits is an open-ended question, where a slower answer beats
// an abort. Kept above the backend's own CHAT_TIMEOUT_S (40s) so the reason the
// worker sees is the server's, which names the actual cause, not a bare timeout.
const TIMEOUT_MS = 45000;

export async function askCloud(
    question: string,
    ctx: { role: string | null; language: Language }
): Promise<CloudResult> {
    // Checked here as well as in the widget, so no future caller can reach the
    // model with a question the guard would have declined. Both call the same
    // isInScope, so there is one rule, not two that can drift apart.
    if (!isInScope(question)) {
        return { answer: null, reason: 'out-of-scope' };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return { answer: null, reason: 'offline' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(`${reportingBaseUrl()}/api/v1/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question,
                context: buildGroundingBrief(ctx.language),
                role: ctx.role,
                language: ctx.language,
            }),
            signal: controller.signal,
        });

        if (response.status === 503) {
            await warnWithServerReason(response, 'cloud assistant not configured');
            return { answer: null, reason: 'not-configured' };
        }
        if (!response.ok) {
            // The worker sees a calm sentence; the operator needs the real cause.
            // A rejected key and an exhausted quota are indistinguishable on
            // screen, and both look exactly like "the cloud is down" — which is
            // how a demo gets debugged for an hour in the wrong place.
            await warnWithServerReason(response, 'cloud assistant call failed');
            return { answer: null, reason: 'error' };
        }

        const data = (await response.json()) as { answer?: string; model?: string };
        const answer = data.answer?.trim();
        if (!answer) return { answer: null, reason: 'error' };
        return { answer, model: data.model };
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            return { answer: null, reason: 'timeout' };
        }
        return { answer: null, reason: 'unreachable' };
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Log the server's own explanation for a failed chat call.
 *
 * Never shown in the chat bubble: provider error bodies are written for
 * operators, not for someone at a bedside, and the widget's own wording already
 * tells the worker what to do instead. This only makes the cause reachable.
 */
async function warnWithServerReason(response: Response, label: string): Promise<void> {
    try {
        const body = (await response.json()) as { detail?: unknown };
        const detail = typeof body?.detail === 'string' ? body.detail : JSON.stringify(body?.detail);
        console.warn(`[NalamMesh assistant] ${label} (HTTP ${response.status}): ${detail}`);
    } catch {
        // A non-JSON body is not worth a second failure — the status alone still
        // says more than nothing.
        console.warn(`[NalamMesh assistant] ${label} (HTTP ${response.status})`);
    }
}
