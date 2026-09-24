/**
 * Bhashini (National Language Translation Mission) — speech recognition and
 * translation for staff, called from the relay so the integrator's keys never
 * reach a browser.
 *
 * Follows the Bhashini API guide (bhashini.gitbook.io/bhashini-apis):
 *
 *   1. Pipeline Config  POST https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline
 *                       headers userID, ulcaApiKey
 *                       { pipelineTasks: [{ taskType, config: { language } }],
 *                         pipelineRequestConfig: { pipelineId } }
 *                       → pipelineResponseConfig[].config[].serviceId,
 *                         pipelineInferenceAPIEndPoint { callbackUrl, inferenceApiKey { name, value } }
 *   2. Pipeline Compute POST {callbackUrl}, header {inferenceApiKey.name}: {inferenceApiKey.value}
 *                       { pipelineTasks: [{ taskType, config: { language, serviceId, … } }],
 *                         inputData: { input: [{ source }], audio: [{ audioContent }] } }
 *                       → pipelineResponse[0].output[0].source | .target
 *
 * Configuration (from the integrator's ULCA "My Profile" and a pipeline search):
 * BHASHINI_USER_ID, BHASHINI_ULCA_API_KEY, BHASHINI_PIPELINE_ID. Without all
 * three, every call answers "not configured" — nothing is faked.
 *
 * @module server/relay/bhashini
 */

export interface BhashiniConfig {
    userId: string;
    ulcaApiKey: string;
    pipelineId: string;
    configUrl: string;
}

/** The app's languages, as the ISO-639 codes Bhashini uses. */
export const BHASHINI_LANGUAGES = ['en', 'hi', 'mr'] as const;
export type BhashiniLanguage = (typeof BHASHINI_LANGUAGES)[number];
export const isBhashiniLanguage = (v: unknown): v is BhashiniLanguage => BHASHINI_LANGUAGES.includes(v as BhashiniLanguage);

export function bhashiniConfigFromEnv(env: NodeJS.ProcessEnv = process.env): BhashiniConfig | null {
    const userId = env.BHASHINI_USER_ID?.trim();
    const ulcaApiKey = env.BHASHINI_ULCA_API_KEY?.trim();
    const pipelineId = env.BHASHINI_PIPELINE_ID?.trim();
    if (!userId || !ulcaApiKey || !pipelineId) return null;
    return {
        userId,
        ulcaApiKey,
        pipelineId,
        configUrl: env.BHASHINI_CONFIG_URL?.trim() || 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline',
    };
}

export class BhashiniError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

interface Resolved {
    serviceId: string;
    callbackUrl: string;
    authName: string;
    authValue: string;
    until: number;
}

export function createBhashiniClient(config: BhashiniConfig, fetchImpl: typeof fetch = fetch) {
    const cache = new Map<string, Resolved>();

    async function call(url: string, headers: Record<string, string>, body: object): Promise<Record<string, unknown>> {
        let response: Response;
        try {
            response = await fetchImpl(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(30_000),
            });
        } catch {
            throw new BhashiniError('Bhashini could not be reached', 502);
        }
        const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        if (!response.ok) {
            const detail = (json.message ?? (json.detail as { message?: string } | undefined)?.message ?? json.detail ?? `HTTP ${response.status}`) as string;
            throw new BhashiniError(`Bhashini: ${String(detail)}`, 502);
        }
        return json;
    }

    /** Step 1, cached for an hour per task and language pair. */
    async function resolve(taskType: 'asr' | 'translation', language: Record<string, string>): Promise<Resolved> {
        const key = `${taskType}:${language.sourceLanguage}:${language.targetLanguage ?? ''}`;
        const hit = cache.get(key);
        if (hit && hit.until > Date.now()) return hit;
        const body = await call(
            config.configUrl,
            { userID: config.userId, ulcaApiKey: config.ulcaApiKey },
            { pipelineTasks: [{ taskType, config: { language } }], pipelineRequestConfig: { pipelineId: config.pipelineId } }
        );
        const tasks = Array.isArray(body.pipelineResponseConfig) ? (body.pipelineResponseConfig as Array<{ taskType?: string; config?: Array<{ serviceId?: string }> }>) : [];
        const serviceId = tasks.find(t => t.taskType === taskType)?.config?.[0]?.serviceId;
        const endpoint = body.pipelineInferenceAPIEndPoint as { callbackUrl?: string; inferenceApiKey?: { name?: string; value?: string } } | undefined;
        if (!serviceId || !endpoint?.callbackUrl || !endpoint.inferenceApiKey?.value) {
            throw new BhashiniError(`Bhashini has no ${taskType} service for ${language.sourceLanguage}${language.targetLanguage ? `→${language.targetLanguage}` : ''} in this pipeline`, 400);
        }
        const resolved: Resolved = {
            serviceId,
            callbackUrl: endpoint.callbackUrl,
            authName: endpoint.inferenceApiKey.name || 'Authorization',
            authValue: endpoint.inferenceApiKey.value,
            until: Date.now() + 3600_000,
        };
        cache.set(key, resolved);
        return resolved;
    }

    function firstOutput(body: Record<string, unknown>): { source?: string; target?: string } {
        const response = Array.isArray(body.pipelineResponse) ? (body.pipelineResponse as Array<{ output?: Array<{ source?: string; target?: string }> }>) : [];
        return response[0]?.output?.[0] ?? {};
    }

    return {
        /** Speech to text. `audioBase64` is a WAV recording; `samplingRate` as recorded. */
        async transcribe(audioBase64: string, language: BhashiniLanguage, samplingRate: number): Promise<string> {
            const r = await resolve('asr', { sourceLanguage: language });
            const body = await call(r.callbackUrl, { [r.authName]: r.authValue }, {
                pipelineTasks: [{ taskType: 'asr', config: { language: { sourceLanguage: language }, serviceId: r.serviceId, audioFormat: 'wav', samplingRate } }],
                inputData: { audio: [{ audioContent: audioBase64 }] },
            });
            const text = firstOutput(body).source;
            if (typeof text !== 'string') throw new BhashiniError('Bhashini returned no transcript', 502);
            return text.trim();
        },

        /** Text from one app language to another. */
        async translate(text: string, sourceLanguage: BhashiniLanguage, targetLanguage: BhashiniLanguage): Promise<string> {
            if (sourceLanguage === targetLanguage) return text;
            const r = await resolve('translation', { sourceLanguage, targetLanguage });
            const body = await call(r.callbackUrl, { [r.authName]: r.authValue }, {
                pipelineTasks: [{ taskType: 'translation', config: { language: { sourceLanguage, targetLanguage }, serviceId: r.serviceId } }],
                inputData: { input: [{ source: text }] },
            });
            const out = firstOutput(body).target;
            if (typeof out !== 'string') throw new BhashiniError('Bhashini returned no translation', 502);
            return out.trim();
        },
    };
}
