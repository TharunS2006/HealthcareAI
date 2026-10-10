"""
The assistant, deployed on its own.

WHY THIS FILE EXISTS
--------------------
app/main.py is the district service: it holds identified patient records, so
even with its session-token checks it belongs on a trusted network and nowhere
else.
But the chat assistant needs a public HTTPS address — the deployed frontend is
served over HTTPS, and a browser will not let an HTTPS page call a plain-HTTP
backend, so "run it on the demo laptop" cannot work for anyone following a link.

So this entry point exposes exactly one capability: POST /api/v1/chat. It never
imports app.main, which means no database engine is created and no record route
exists to be found. The API key is the only secret here, and it is read from the
host's environment, never from a file in the repository. The same guard as the
district service's chat route applies (app/chat_guard.py): size caps, rate
limits, identifier redaction, and CHAT_REQUIRE_SIGN_IN — which, with the
relay's NALAMMESH_AUTH_SECRET set here too, admits signed-in staff only.

It shares app/chat_engine.py with the full service rather than restating the
prompt, because two copies of a clinical system prompt is two assistants that
answer the same question differently once someone edits one of them.
"""

import os
import sys
from pathlib import Path

# `app.*` has to resolve before the imports below, and Vercel's working
# directory is not guaranteed to be the one holding app/. This file is also
# staged to a deploy root under a different name (see
# scripts/build_assistant_deploy.sh), where app/ is a sibling rather than an
# uncle, so locate the package root by looking for app/ instead of assuming a
# fixed depth — a hardcoded .parent.parent silently points one level too high
# in the staged copy and fails only at import time, on the host.
_HERE = Path(__file__).resolve().parent
_ROOT = _HERE if (_HERE / "app").is_dir() else _HERE.parent
sys.path.insert(0, str(_ROOT))

# Vercel overwrites x-real-ip with the caller's address, so on Vercel it is the
# address to rate-limit by; everywhere else the TCP peer is (see chat_guard).
# Set before chat_guard is imported, because it reads the setting at import.
if os.environ.get("VERCEL") and not os.environ.get("CHAT_CLIENT_IP_HEADER"):
    os.environ["CHAT_CLIENT_IP_HEADER"] = "x-real-ip"

from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app.chat_engine import _chat_completion, _resolve_provider, chat_hosting  # noqa: E402
from app.chat_guard import ChatCaller, chat_access, redact_identifiers  # noqa: E402
from app.schemas import ChatIn, ChatOut  # noqa: E402

app = FastAPI(
    title="NalamMesh Assistant",
    description=(
        "Layer 2 of the NalamMesh chat assistant. This deployment carries no "
        "patient data and no record store — see app/main.py for the district "
        "service, which is not exposed here."
    ),
    version="1.0.0",
)

# This endpoint spends a metered API key, so it should not be callable from any
# page on the internet. Set CORS_ORIGINS to the deployed frontend's origin; the
# "*" default exists only so a misconfigured host fails open for the demo rather
# than looking like an outage.
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["service"])
def health():
    """
    Liveness, and which provider will answer.

    Deliberately shaped unlike the district service's /health: this one reports
    no store counts, because it has no store. A monitor that saw familiar-looking
    zeroes here would conclude the records had been lost rather than that it was
    asking the wrong service.
    """
    chat = _resolve_provider()
    return {
        "status": "healthy",
        "service": "assistant-only",
        "chat_provider": chat[0] if chat else None,
        "chat_model": chat[1] if chat else None,
        "chat_hosting": chat_hosting(chat[0] if chat else None),
        "record_store": None,
        "note": (
            "Assistant only. This deployment holds no patient records and is not "
            "the district reporting service."
        ),
    }


@app.post("/api/v1/chat", response_model=ChatOut, tags=["chat"])
def chat(payload: ChatIn, caller: ChatCaller = Depends(chat_access)):
    """Identical contract to the district service's /api/v1/chat — same modules
    answer and guard both, so the two cannot drift."""
    question, _ = redact_identifiers(payload.question)
    who = caller.identity
    answer, model = _chat_completion(
        question, payload.context, who.role if who else payload.role, payload.language,
        role_verified=who is not None,
    )
    return ChatOut(answer=answer, model=model)
