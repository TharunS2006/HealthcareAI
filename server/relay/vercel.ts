/**
 * The mesh relay as a Vercel function — for the hosted site, where there is no
 * facility network and every device reaches the relay over the internet.
 *
 * State lives in Upstash Redis (KV_REST_API_URL/TOKEN from the Marketplace, or
 * UPSTASH_REDIS_REST_URL/TOKEN) and there are no websockets: devices poll
 * /api/referrals/since every 10 seconds, the transport the app already falls
 * back to (lib/referrals/transport.ts). Missing configuration makes every
 * request a 503 naming it (./hosted.ts), never a relay that loses referrals.
 *
 * Deployed with scripts/build-relay-deploy.sh, never from the repo root.
 *
 * @module server/relay/vercel
 */

import { createHostedApp } from './hosted';

export default createHostedApp();
