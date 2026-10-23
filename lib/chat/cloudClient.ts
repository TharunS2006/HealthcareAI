/**
 * NalamMesh Assistant — cloud client (Layer 2).
 *
 * Calls the district reporting service's /api/v1/chat endpoint, which relays the
 * question plus a grounding brief to whichever model that service is configured
 * for (a self-hosted model, Groq, Grok or Claude — it reports back which one
 * answered). Personal identifiers are removed from the question first
 * (lib/chat/redact.ts), and a signed-in worker's relay token rides along so the
 * service knows their role rather than taking the widget's word for it. This is strictly
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
import { useAuthStore } from '@/stores/authStore';
import { chatBaseUrl, reportingBaseUrl } from '@/lib/cloudEndpoint';
import { buildGroundingBrief } from './groundingBrief';
import { redactIdentifiers } from './redact';
import { isInScope } from './scopeGuard';

export interface CloudResult {
    answer: string | null;
    /**
     * Why there is no answer. Shown to the worker so a silent blank never happens.
     * 'restricted': this deployment's cloud layer answers signed-in staff only.
     * 'busy': the service's rate limit refused the question for now.
     */
    reason?: 'out-of-scope' | 'offline' | 'not-configured' | 'restricted' | 'busy' | 'unreachable' | 'timeout' | 'error';
    model?: string;
    /** How many personal identifiers were removed from the question before it was sent. */
    redacted?: number;
}

/** The longest question the service accepts (backend/app/schemas.py ChatIn). */
export const MAX_QUESTION_CHARS = 1000;

/** The signed-in user's relay token, while it is still valid — proof of role for the service. */
function sessionAuthHeader(): Record<string, string> {
    const session = useAuthStore.getState().session;
    return session?.token && (session.tokenExpiresAt ?? 0) > Date.now()
        ? { Authorization: `Bearer ${session.token}` }
        : {};
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

    // Identifiers never leave the device; the service repeats this for any
    // other caller. The count is reported so the widget can say so.
    const { text: outbound, removed } = redactIdentifiers(question.slice(0, MAX_QUESTION_CHARS));
    const redacted = removed || undefined;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch(`${chatBaseUrl()}/api/v1/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...sessionAuthHeader() },
            body: JSON.stringify({
                question: outbound,
                context: buildGroundingBrief(ctx.language),
                role: ctx.role,
                language: ctx.language,
            }),
            signal: controller.signal,
        });

        if (response.status === 503) {
            await warnWithServerReason(response, 'cloud assistant not configured');
            return { answer: null, reason: 'not-configured', redacted };
        }
        if (response.status === 401 || response.status === 403) {
            await warnWithServerReason(response, 'cloud assistant is for signed-in staff on this deployment');
            return { answer: null, reason: 'restricted', redacted };
        }
        if (response.status === 429) {
            await warnWithServerReason(response, 'cloud assistant rate limit');
            return { answer: null, reason: 'busy', redacted };
        }
        if (!response.ok) {
            // The worker sees a calm sentence; the operator needs the real cause.
            // A rejected key and an exhausted quota are indistinguishable on
            // screen, and both look exactly like "the cloud is down" — which is
            // how a demo gets debugged for an hour in the wrong place.
            await warnWithServerReason(response, 'cloud assistant call failed');
            return { answer: null, reason: 'error', redacted };
        }

        const data = (await response.json()) as { answer?: string; model?: string };
        const answer = data.answer?.trim();
        if (!answer) return { answer: null, reason: 'error', redacted };
        return { answer, model: data.model, redacted };
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            return { answer: null, reason: 'timeout', redacted };
        }
        return { answer: null, reason: 'unreachable', redacted };
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
