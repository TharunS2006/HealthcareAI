#!/usr/bin/env bash
#
# Stage the chat-only assistant into a deploy root of its own.
#
# WHY A SEPARATE TREE
# -------------------
# Deploying backend/ directly does not work, and not for a reason a flag can
# fix: Vercel inspects the uploaded tree, finds Procfile ("web: uvicorn
# app.main:app"), and persists a project-level service pointing at the district
# service. That is the half that owns identified patient records and has no
# authentication, so the wrong deploy is not merely broken, it is the one that
# must never be public. .vercelignore does not undo it, because the detection is
# already saved against the project.
#
# So the assistant is deployed from a tree where the district service does not
# exist to be detected: no Procfile, no app/main.py, no models beyond the enums
# the chat schemas import, and no .env or .db to leak. The tree is generated
# rather than hand-maintained, so app/chat_engine.py has exactly one copy and
# the deployed assistant cannot drift from the local one.
#
# Usage:  bash scripts/build_assistant_deploy.sh   (then deploy from the path it prints)

set -euo pipefail

BACKEND="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Outside the repository on purpose, and overridable as $1.
#
# Inside it, the Vercel CLI kept resolving the project link upward into
# backend/ — the tree that holds Procfile, app/main.py and district.db — and a
# deploy rooted there publishes the unauthenticated district service. Vercel
# infers the root from the surrounding git repository, so the only reliable fix
# is to stage where no repository, Procfile or database sits above us.
OUT="${1:-$HOME/nalammesh-assistant-deploy}"

# Remove only what this script generates. .vercel/ (the project link) and
# .env.local (the CLI's OIDC token) are written into this tree by the Vercel CLI
# and are not ours to recreate — a blanket rm -rf here unlinks the project, and
# the next deploy silently creates a *second* one at a different URL while the
# frontend still points at the first.
rm -rf "$OUT/app" "$OUT/main.py" "$OUT/requirements.txt" "$OUT/vercel.json" "$OUT/.vercelignore"
mkdir -p "$OUT/app"

# main.py at the root is Vercel's FastAPI entrypoint convention. api/index.py is
# the source of truth; it resolves the package root by looking for app/, so it
# works under either name and either depth.
cp "$BACKEND/api/index.py" "$OUT/main.py"

# Only the modules the chat path actually reaches. models.py is here because
# schemas.py imports three enums from it — not because anything creates a table.
# Copying main.py here would defeat the entire point of this script.
for f in __init__.py env.py chat_engine.py schemas.py models.py; do
  cp "$BACKEND/app/$f" "$OUT/app/$f"
done

# uvicorn is dropped: Vercel supplies the server. Everything else is needed —
# sqlmodel for the enums in models.py, httpx for the Groq call, anthropic for
# the provider the key may select, python-dotenv because chat_engine imports env.
grep -v '^uvicorn' "$BACKEND/requirements.txt" > "$OUT/requirements.txt"

# No "services" key. That is a private, undocumented vercel.json feature, and
# configuring it explicitly built the function but routed nothing to it — every
# path answered NOT_FOUND. Plain FastAPI auto-detection routes correctly.
cat > "$OUT/vercel.json" <<'JSON'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "fastapi"
}
JSON

# Belt and braces: this tree is generated from a directory that does contain a
# database and a .env, so refuse to ship either even if a copy above changes.
cat > "$OUT/.vercelignore" <<'IGN'
.env*
*.db
.vercel/
__pycache__/
app/__pycache__/
IGN

echo "Staged assistant deploy root: $OUT"
find "$OUT" -type f -not -path '*/__pycache__/*' | sed "s|$OUT|  .|" | sort
