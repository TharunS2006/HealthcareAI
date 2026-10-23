/**
 * Bhashini from the browser: record a voice note as WAV, and ask the relay
 * (server/relay/bhashini.ts) — which holds the Bhashini keys — to transcribe or
 * translate. Staff only: every call carries the session token.
 *
 * @module lib/bhashini/client
 */

import { relayBaseUrl } from '@/lib/socket';
import { blockedAsMixedContent } from '@/lib/cloudEndpoint';
import { identityHeaders } from '@/lib/referrals/transport';

export type AppLanguage = 'en' | 'hi' | 'mr';
export const MAX_RECORDING_SECONDS = 20;

/** Is Bhashini configured on the relay this build talks to? Cached per page for a minute. */
let statusCache: { at: number; value: boolean } | null = null;
export async function bhashiniAvailable(): Promise<boolean> {
    if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;
    const url = `${relayBaseUrl()}/health`;
    let value = false;
    if (!blockedAsMixedContent(url)) {
        try {
            const health = (await (await fetch(url, { signal: AbortSignal.timeout(4000) })).json()) as { bhashini?: string };
            value = health.bhashini === 'configured';
        } catch {
            value = false;
        }
    }
    statusCache = { at: Date.now(), value };
    return value;
}

async function relayPost<T>(path: string, body: object): Promise<T> {
    const url = `${relayBaseUrl()}${path}`;
    if (blockedAsMixedContent(url)) throw new Error('The language service cannot be reached from this page');
    const headers = identityHeaders();
    if (!headers.Authorization) throw new Error('Sign in to the referral network (re-enter your PIN) to use Bhashini');
    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(45_000),
        });
    } catch {
        throw new Error('The language service could not be reached');
    }
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) throw new Error(data.error ?? `Bhashini request failed (HTTP ${response.status})`);
    return data;
}

export const transcribe = (audio: string, language: AppLanguage, samplingRate: number) =>
    relayPost<{ text: string }>('/api/bhashini/asr', { audio, language, samplingRate }).then(r => r.text);

export const translate = (text: string, source: AppLanguage, target: AppLanguage) =>
    relayPost<{ text: string }>('/api/bhashini/translate', { text, source, target }).then(r => r.text);

/** Devanagari text is Hindi or Marathi — which, the reader's own language decides; anything else is taken as English. */
export function guessLanguage(text: string, uiLanguage: AppLanguage): AppLanguage {
    if (/[ऀ-ॿ]/.test(text)) return uiLanguage === 'mr' ? 'mr' : 'hi';
    return 'en';
}

// ── recording ────────────────────────────────────────────────────────────────

/** 16-bit PCM mono WAV, base64 — what Bhashini's ASR expects (`audioFormat: wav`). */
function encodeWav(chunks: Float32Array[], sampleRate: number): string {
    const length = chunks.reduce((n, c) => n + c.length, 0);
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    const text = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
    text(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); text(8, 'WAVE');
    text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, 'data'); view.setUint32(40, length * 2, true);
    let offset = 44;
    for (const chunk of chunks) {
        for (let i = 0; i < chunk.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, chunk[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }
    }
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

export interface Recording {
    /** Stop, and get the WAV. */
    stop: () => Promise<{ audio: string; samplingRate: number; seconds: number }>;
    cancel: () => void;
}

/** Start recording from the microphone. Stops by itself after MAX_RECORDING_SECONDS. */
export async function startRecording(onAutoStop?: () => void): Promise<Recording> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    // 16 kHz where the browser allows it — Bhashini's documented rate; else whatever the device gives.
    let ctx: AudioContext;
    try {
        ctx = new AudioContext({ sampleRate: 16000 });
    } catch {
        ctx = new AudioContext();
    }
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    processor.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    source.connect(processor);
    processor.connect(ctx.destination);
    const started = Date.now();

    const release = () => {
        processor.disconnect();
        source.disconnect();
        stream.getTracks().forEach(t => t.stop());
        void ctx.close();
    };
    const timer = setTimeout(() => onAutoStop?.(), MAX_RECORDING_SECONDS * 1000);

    return {
        stop: async () => {
            clearTimeout(timer);
            release();
            return { audio: encodeWav(chunks, ctx.sampleRate), samplingRate: ctx.sampleRate, seconds: (Date.now() - started) / 1000 };
        },
        cancel: () => {
            clearTimeout(timer);
            release();
        },
    };
}
