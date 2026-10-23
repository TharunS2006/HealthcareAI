/**
 * Bhashini contract — `npm run verify:bhashini`
 *
 * The relay's Bhashini client (server/relay/bhashini.ts) against a stand-in
 * for Bhashini's two services, enforcing what bhashini.gitbook.io documents:
 *
 *   1. CONFIG     userID + ulcaApiKey headers; pipelineTasks with the language;
 *                 pipelineRequestConfig.pipelineId; result cached per language
 *   2. COMPUTE    sent to the returned callbackUrl with the returned inference
 *                 key header; serviceId, audioFormat and samplingRate for ASR;
 *                 output[0].source (ASR) / output[0].target (translation) read
 *   3. ACCESS     staff token required; bad input refused before Bhashini is
 *                 called; not configured → 503; unreachable → 502
 */

import { createServer, type IncomingMessage } from 'node:http';

const { createRelay } = await import('../server/relay/app');
const { MemoryStore } = await import('../server/relay/store');
const { createBhashiniClient } = await import('../server/relay/bhashini');

let failures = 0;
function check(label: string, condition: boolean, detail = ''): void {
    if (condition) console.log(` PASS ${label}`);
    else {
        failures += 1;
        console.log(` FAIL ${label}${detail ? ` — ${detail}` : ''}`);
    }
}

const USER = 'ulca-user-1';
const KEY = 'ulca-key-1';
const PIPELINE = 'pipeline-abc';
const INFER_KEY = 'inference-secret';
const AUDIO = Buffer.from('RIFF....WAVEfmt fake audio bytes for the stand-in').toString('base64').repeat(4);
const seen = { configCalls: 0, problems: [] as string[] };
const body = (req: IncomingMessage) => new Promise<string>(res => { let s = ''; req.on('data', c => (s += c)); req.on('end', () => res(s)); });

let base = '';
const bhashini = createServer(async (req, res) => {
    const send = (status: number, payload: object) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(payload));
    const json = JSON.parse((await body(req)) || '{}');
    if (req.url === '/config') {
        seen.configCalls += 1;
        if (req.headers.userid !== USER || req.headers.ulcaapikey !== KEY) return send(401, { message: 'Invalid userID or ulcaApiKey' });
        if (json.pipelineRequestConfig?.pipelineId !== PIPELINE) seen.problems.push('pipelineId missing');
        const task = json.pipelineTasks?.[0];
        const lang = task?.config?.language;
        if (!task?.taskType || !lang?.sourceLanguage) seen.problems.push(`config task/language missing: ${JSON.stringify(json)}`);
        if (lang?.sourceLanguage === 'xx') return send(200, { pipelineResponseConfig: [], pipelineInferenceAPIEndPoint: { callbackUrl: `${base}/compute`, inferenceApiKey: { name: 'Authorization', value: INFER_KEY } } });
        return send(200, {
            pipelineResponseConfig: [{ taskType: task.taskType, config: [{ serviceId: `svc-${task.taskType}-${lang.sourceLanguage}`, language: lang }] }],
            pipelineInferenceAPIEndPoint: { callbackUrl: `${base}/compute`, inferenceApiKey: { name: 'Authorization', value: INFER_KEY }, isSyncApi: true },
        });
    }
    if (req.url === '/compute') {
        if (req.headers.authorization !== INFER_KEY) return send(401, { message: 'bad inference key' });
        const t = json.pipelineTasks?.[0];
        if (t?.taskType === 'asr') {
            const c = t.config;
            if (c?.serviceId !== `svc-asr-${c?.language?.sourceLanguage}` || c.audioFormat !== 'wav' || c.samplingRate !== 16000) seen.problems.push(`asr config wrong: ${JSON.stringify(c)}`);
            if (json.inputData?.audio?.[0]?.audioContent !== AUDIO) seen.problems.push('audioContent not passed through');
            return send(200, { pipelineResponse: [{ taskType: 'asr', output: [{ source: 'रुग्णाला तीन दिवसांपासून ताप आहे' }] }] });
        }
        if (t?.taskType === 'translation') {
            const c = t.config;
            if (c?.serviceId !== `svc-translation-${c?.language?.sourceLanguage}` || !c.language.targetLanguage) seen.problems.push(`translation config wrong: ${JSON.stringify(c)}`);
            const src = json.inputData?.input?.[0]?.source;
            return send(200, { pipelineResponse: [{ taskType: 'translation', output: [{ source: src, target: `[${c.language.targetLanguage}] ${src}` }] }] });
        }
        return send(400, { message: 'unknown task' });
    }
    send(404, {});
});
await new Promise<void>(r => bhashini.listen(0, '127.0.0.1', () => r()));
base = `http://127.0.0.1:${(bhashini.address() as { port: number }).port}`;

const SECRET = 'b'.repeat(40);
async function serve(client: ReturnType<typeof createBhashiniClient> | null) {
    const { app } = createRelay({ store: new MemoryStore(), secret: SECRET, bhashini: client });
    const server = createServer(app);
    await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
    return { server, url: `http://127.0.0.1:${(server.address() as { port: number }).port}` };
}
const configured = await serve(createBhashiniClient({ userId: USER, ulcaApiKey: KEY, pipelineId: PIPELINE, configUrl: `${base}/config` }));
const unconfigured = await serve(null);
const unreachable = await serve(createBhashiniClient({ userId: USER, ulcaApiKey: KEY, pipelineId: PIPELINE, configUrl: 'http://127.0.0.1:9/config' }));

const token = async (url: string) =>
    ((await (await fetch(`${url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'u-anm-kothi', pin: '2468' }) })).json()) as { token: string }).token;
const post = async (url: string, path: string, payload: unknown, signedIn = true) =>
    fetch(`${url}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(signedIn ? { Authorization: `Bearer ${await token(url)}` } : {}) }, body: JSON.stringify(payload) });

// ---------------------------------------------------------------------------
console.log('\n1–2. CONFIG AND COMPUTE');
// ---------------------------------------------------------------------------
const asr = await post(configured.url, '/api/bhashini/asr', { audio: AUDIO, language: 'mr', samplingRate: 16000 });
const asrBody = (await asr.json()) as { text?: string };
check('speech in Marathi is transcribed', asr.status === 200 && asrBody.text === 'रुग्णाला तीन दिवसांपासून ताप आहे', JSON.stringify(asrBody));
const tr = await post(configured.url, '/api/bhashini/translate', { text: 'Fever for three days', source: 'en', target: 'hi' });
check('text is translated to the requested language', tr.status === 200 && ((await tr.json()) as { text: string }).text === '[hi] Fever for three days');
await post(configured.url, '/api/bhashini/asr', { audio: AUDIO, language: 'mr', samplingRate: 16000 });
check('the pipeline config is fetched once per task and language, then cached', seen.configCalls === 2, `${seen.configCalls} config calls`);
check('headers, pipelineId, serviceId, audio format, rate and content all as documented', seen.problems.length === 0, seen.problems.join(' | '));
const same = await post(configured.url, '/api/bhashini/translate', { text: 'same', source: 'mr', target: 'mr' });
check('translating into the same language returns the text unchanged', ((await same.json()) as { text: string }).text === 'same');

// ---------------------------------------------------------------------------
console.log('\n3. ACCESS AND FAILURE');
// ---------------------------------------------------------------------------
check('voice input needs a signed-in staff member (401)', (await post(configured.url, '/api/bhashini/asr', { audio: AUDIO, language: 'mr', samplingRate: 16000 }, false)).status === 401);
check('translation needs a signed-in staff member (401)', (await post(configured.url, '/api/bhashini/translate', { text: 'x', source: 'en', target: 'hi' }, false)).status === 401);
check('an unsupported language is refused (400)', (await post(configured.url, '/api/bhashini/asr', { audio: AUDIO, language: 'fr', samplingRate: 16000 })).status === 400);
check('an implausible sampling rate is refused (400)', (await post(configured.url, '/api/bhashini/asr', { audio: AUDIO, language: 'hi', samplingRate: 12 })).status === 400);
check('over-long text is refused (400)', (await post(configured.url, '/api/bhashini/translate', { text: 'x'.repeat(2001), source: 'en', target: 'hi' })).status === 400);
const none = await post(unconfigured.url, '/api/bhashini/translate', { text: 'x', source: 'en', target: 'hi' });
check('no Bhashini keys → 503 "not configured", nothing faked', none.status === 503 && /not configured/.test(((await none.json()) as { error: string }).error));
const down = await post(unreachable.url, '/api/bhashini/translate', { text: 'x', source: 'en', target: 'hi' });
check('Bhashini unreachable → 502 with a reason', down.status === 502 && /could not be reached/.test(((await down.json()) as { error: string }).error));
check('/health says whether Bhashini is configured',
    ((await (await fetch(`${configured.url}/health`)).json()) as { bhashini: string }).bhashini === 'configured'
    && ((await (await fetch(`${unconfigured.url}/health`)).json()) as { bhashini: string }).bhashini === 'not configured');

[configured, unconfigured, unreachable].forEach(s => s.server.close());
bhashini.close();
console.log(failures === 0 ? '\nAll Bhashini checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
