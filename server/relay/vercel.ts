/**
 * The mesh relay as a Vercel function — for the hosted site, where there is no
 * facility network and every device reaches the relay over the internet.
 *
 * Serverless instances come and go and run side by side, so this entry keeps
 * state in Upstash Redis (UPSTASH_REDIS_REST_URL/TOKEN or the Marketplace's
 * KV_REST_API_URL/TOKEN) and has no websockets: devices poll
 * /api/referrals/since every 10 seconds, the transport the app already falls
 * back to (lib/referrals/transport.ts). NALAMMESH_AUTH_SECRET must be set.
 *
 * Deployed with scripts/build-relay-deploy.sh, never from the repo root.
 *
 * @module server/relay/vercel
 */

import { createRelay } from './app';
import { resolveAuthSecret } from './auth';
import { storeFromEnv } from './store';
import { abdmConfigFromEnv, createAbdmClient } from './abha';
import { bhashiniConfigFromEnv, createBhashiniClient } from './bhashini';

const store = storeFromEnv();
if (store.kind !== 'upstash') {
    // Memory on a serverless platform loses referrals between requests. Say so
    // on every health check rather than appearing to work.
    console.error('Hosted relay: no Upstash credentials — state will not survive between requests');
}

const abdmConfig = abdmConfigFromEnv();
const bhashiniConfig = bhashiniConfigFromEnv();
const { app } = createRelay({
    store,
    secret: resolveAuthSecret(),
    abdm: abdmConfig ? createAbdmClient(abdmConfig) : null,
    bhashini: bhashiniConfig ? createBhashiniClient(bhashiniConfig) : null,
    log: (message, data) => console.log(JSON.stringify({ message, ...data })),
});

export default app;
