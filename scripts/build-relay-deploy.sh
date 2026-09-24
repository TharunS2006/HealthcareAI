#!/usr/bin/env bash
#
# Stage the hosted mesh relay into a deploy root of its own.
#
# The relay (server/relay/vercel.ts) is bundled with esbuild into one file, so
# the deploy tree holds nothing but it: no backend/, no district.db, no .env —
# the same reason the assistant is staged outside the repository
# (backend/scripts/build_assistant_deploy.sh). Deployed as a Vercel function
# with every path rewritten to it.
#
# The project needs three environment variables (never in this tree):
#   NALAMMESH_AUTH_SECRET     32+ random characters; signs session tokens
#   KV_REST_API_URL / _TOKEN  from the Upstash for Redis Marketplace integration
#                             (UPSTASH_REDIS_REST_URL / _TOKEN also accepted)
#
# Usage:  bash scripts/build-relay-deploy.sh [out-dir]
#         cd <out-dir> && npx vercel@latest deploy --prod

set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${1:-$HOME/nalammesh-relay-deploy}"

# Only what this script generates. .vercel/ (the project link) and .env.local
# (the CLI's token) belong to the Vercel CLI: removing them silently creates a
# second project at a different URL on the next deploy.
rm -rf "$OUT/api" "$OUT/vercel.json" "$OUT/package.json"
mkdir -p "$OUT/api"

cd "$REPO"
node_modules/.bin/esbuild server/relay/vercel.ts \
  --bundle --platform=node --format=cjs --target=node20 \
  --outfile="$OUT/api/relay.js" --log-level=warning

# Vercel calls the module's export as the request handler; the relay's is an Express app.
cat > "$OUT/api/index.js" <<'JS'
module.exports = require('./relay.js').default;
JS

cat > "$OUT/vercel.json" <<'JSON'
{
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
JSON

cat > "$OUT/package.json" <<'JSON'
{
  "name": "nalammesh-relay",
  "private": true,
  "engines": { "node": "24.x" }
}
JSON

echo "Relay staged in $OUT ($(du -h "$OUT/api/relay.js" | cut -f1) bundle)"
