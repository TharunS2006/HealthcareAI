/**
 * The hosted relay's configuration check, apart from the Vercel entry so it can
 * be tested.
 *
 * Serverless instances come and go and run side by side. Without Upstash each
 * would keep referrals in its own memory, and a referral sent through one would
 * never reach a device polling another — the relay would appear to work while
 * losing patients. Without a signing secret nobody could sign in. Either way
 * this answers every request with 503 and names what is missing, so the app
 * shows the relay as unavailable and keeps work on the device, rather than
 * trusting a relay that drops it.
 */

import express from 'express';
import { createRelay } from './app';
import { resolveAuthSecret } from './auth';
import { storeFromEnv } from './store';
import { abdmConfigFromEnv, createAbdmClient } from './abha';
import { bhashiniConfigFromEnv, createBhashiniClient } from './bhashini';

/** What a hosted deployment is missing; empty when it can serve. */
export function hostedMisconfiguration(env: NodeJS.ProcessEnv): string[] {
    const missing: string[] = [];
    if (storeFromEnv(env).kind !== 'upstash') missing.push('Upstash credentials (KV_REST_API_URL and KV_REST_API_TOKEN)');
    if (!resolveAuthSecret({ ...env, VERCEL: env.VERCEL ?? '1' })) missing.push('NALAMMESH_AUTH_SECRET (32+ characters)');
    return missing;
}

export function createHostedApp(env: NodeJS.ProcessEnv = process.env, log: (message: string, data?: object) => void = (message, data) => console.log(JSON.stringify({ message, ...data }))): express.Express {
    const missing = hostedMisconfiguration(env);
    if (missing.length > 0) {
        console.error(`Hosted relay refusing requests — missing ${missing.join('; ')}`);
        const refuse = express();
        refuse.use((req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (req.method === 'OPTIONS') return res.sendStatus(204);
            res.status(503).json({ status: 'misconfigured', error: `The relay is not configured: missing ${missing.join('; ')}.` });
        });
        return refuse;
    }

    const abdmConfig = abdmConfigFromEnv(env);
    const bhashiniConfig = bhashiniConfigFromEnv(env);
    return createRelay({
        store: storeFromEnv(env),
        secret: resolveAuthSecret({ ...env, VERCEL: env.VERCEL ?? '1' }),
        abdm: abdmConfig ? createAbdmClient(abdmConfig) : null,
        bhashini: bhashiniConfig ? createBhashiniClient(bhashiniConfig) : null,
        log,
    }).app;
}
