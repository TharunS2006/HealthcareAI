"""
Cloud chat provider check — `python3 scripts/verify_chat_provider.py`

The assistant has two layers. Layer 1 answers offline and is covered by the
verify-chat-* suites on the frontend. This one covers Layer 2: the backend
relay that hands an unanswered question to Groq, Grok (xAI) or Claude.

Four things can break here without anyone noticing until a demo:

  1. The key is set but in the variable the code does not read, so the endpoint
     answers 503 and looks exactly like "no cloud configured". Groq and Grok
     are different services whose names differ by one letter, so this is not a
     hypothetical: it is the first thing that goes wrong.
  2. Grok answers, but the response is attributed to the Claude model because
     the endpoint reports the configured name instead of the one that ran.
  3. The provider fails — rejected key, unknown model, quota — and the worker
     is told only "unavailable", with the actual reason discarded.
  4. Widening the prompt so it can answer questions about the platform quietly
     drops one of the clinical rails it shares a prompt with.

No network: the provider call is replaced with a stub, so this runs anywhere
and never spends a token.
"""
import importlib
import os
import sys
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/verify_chat_provider.db"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Hermetic by force. backend/.env holds a real key on a developer's machine, and
# letting load_dotenv run would inject it into every case below — "no key at
# all" would resolve to a provider, and the suite would pass while asserting
# nothing. The environment this script builds is the only input it gets.
try:
    import dotenv

    dotenv.load_dotenv = lambda *a, **k: False
except ImportError:
    pass

from fastapi import HTTPException  # noqa: E402

failures = []


def check(label, condition, detail=""):
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}" + (f"\n        {detail}" if detail else ""))
        failures.append(label)


CHAT_ENV = ("XAI_API_KEY", "GROK_API_KEY", "GROQ_API_KEY", "ANTHROPIC_API_KEY",
            "CHAT_PROVIDER", "XAI_MODEL", "GROQ_MODEL", "ANTHROPIC_MODEL",
            "XAI_BASE_URL", "GROQ_BASE_URL", "CHAT_BASE_URL", "CHAT_MODEL", "CHAT_API_KEY")


def load(**env):
    """
    Re-import app.chat_engine under a given environment.

    The provider constants are read at import time — which is what makes an
    unset key a startup fact rather than a per-request surprise — so the only
    honest way to test the selection is to import the module again.

    It must be chat_engine and not main: main only holds a reference to the
    resolved functions, so reloading main would re-bind those names without
    re-reading a single key, and every assertion below would keep passing
    against the constants of whichever environment was set first.
    """
    for name in CHAT_ENV:
        os.environ.pop(name, None)
    for name, value in env.items():
        os.environ[name] = value
    import app.chat_engine
    return importlib.reload(app.chat_engine)


# ── 1. which provider answers ───────────────────────────────────────────────
print("\nThe provider is chosen by which key is actually present:")

m = load()
check("no key at all → no provider", m._resolve_provider() is None,
      f"got {m._resolve_provider()}")

m = load(GROQ_API_KEY="gsk_test")
check("GROQ_API_KEY alone → groq",
      m._resolve_provider() == ("groq", "openai/gpt-oss-120b"), f"got {m._resolve_provider()}")

m = load(XAI_API_KEY="xai-test")
check("XAI_API_KEY alone → grok", m._resolve_provider() == ("grok", "grok-4"),
      f"got {m._resolve_provider()}")

m = load(GROK_API_KEY="xai-test")
check("GROK_API_KEY is accepted as an alias, not ignored",
      m._resolve_provider() == ("grok", "grok-4"), f"got {m._resolve_provider()}")

m = load(ANTHROPIC_API_KEY="sk-ant-test")
check("ANTHROPIC_API_KEY alone → anthropic",
      m._resolve_provider() == ("anthropic", "claude-sonnet-5"), f"got {m._resolve_provider()}")

m = load(XAI_API_KEY="xai-test", ANTHROPIC_API_KEY="sk-ant-test")
check("both keys, no preference → grok", m._resolve_provider()[0] == "grok",
      f"got {m._resolve_provider()}")

m = load(XAI_API_KEY="xai-test", ANTHROPIC_API_KEY="sk-ant-test", CHAT_PROVIDER="anthropic")
check("CHAT_PROVIDER=anthropic wins over a present Grok key",
      m._resolve_provider()[0] == "anthropic", f"got {m._resolve_provider()}")

m = load(ANTHROPIC_API_KEY="sk-ant-test", CHAT_PROVIDER="grok")
check("CHAT_PROVIDER=grok with no Grok key → 503, not a silent fallback to Claude",
      m._resolve_provider() is None, f"got {m._resolve_provider()}")

m = load(GROQ_API_KEY="gsk_test", XAI_API_KEY="xai-test", ANTHROPIC_API_KEY="sk-ant-test")
check("all three keys, no preference → groq", m._resolve_provider()[0] == "groq",
      f"got {m._resolve_provider()}")

m = load(GROQ_API_KEY="gsk_test", CHAT_PROVIDER="groq", GROQ_MODEL="openai/gpt-oss-20b")
check("GROQ_MODEL overrides the default",
      m._resolve_provider() == ("groq", "openai/gpt-oss-20b"), f"got {m._resolve_provider()}")

m = load(XAI_API_KEY="xai-test", XAI_MODEL="grok-3")
check("XAI_MODEL overrides the default", m._resolve_provider() == ("grok", "grok-3"),
      f"got {m._resolve_provider()}")


# ── 1b. Groq and Grok are one letter apart, and get swapped ─────────────────
# Two different companies. A key in the other one's variable would be sent to an
# endpoint that cannot accept it, and the reply — "Incorrect API key" — blames
# the key rather than the mix-up, which is a long evening for whoever is holding
# the laptop. The prefixes tell them apart, so the swap is corrected at startup.
print("\nA key in the other service's variable is recognised, not rejected:")

import app.chat_engine as _m  # noqa: E402  (module-level guard runs at import)

os.environ.pop("GROQ_API_KEY", None)
os.environ["XAI_API_KEY"] = "gsk_looks_like_groq"
_m = importlib.reload(_m)
check("a gsk_ key sitting in XAI_API_KEY is used for Groq, not sent to api.x.ai",
      _m.GROQ_API_KEY == "gsk_looks_like_groq" and _m.XAI_API_KEY is None
      and _m._resolve_provider()[0] == "groq",
      f"groq={_m.GROQ_API_KEY!r} xai={_m.XAI_API_KEY!r} resolved={_m._resolve_provider()}")

os.environ.pop("XAI_API_KEY", None)
os.environ["GROQ_API_KEY"] = "xai-looks-like-grok"
_m = importlib.reload(_m)
check("an xai- key sitting in GROQ_API_KEY is used for Grok, not sent to api.groq.com",
      _m.XAI_API_KEY == "xai-looks-like-grok" and _m.GROQ_API_KEY is None
      and _m._resolve_provider()[0] == "grok",
      f"groq={_m.GROQ_API_KEY!r} xai={_m.XAI_API_KEY!r} resolved={_m._resolve_provider()}")

os.environ["GROQ_API_KEY"] = "gsk_real"
os.environ["XAI_API_KEY"] = "xai-real"
_m = importlib.reload(_m)
check("two correctly-placed keys are left alone",
      _m.GROQ_API_KEY == "gsk_real" and _m.XAI_API_KEY == "xai-real",
      f"groq={_m.GROQ_API_KEY!r} xai={_m.XAI_API_KEY!r}")


# ── 2. the unconfigured case says what to set ───────────────────────────────
print("\nAn unconfigured service explains itself:")
m = load()
try:
    m._chat_completion("q", "ctx", "MO", "en")
    check("unconfigured → 503", False, "no exception raised")
except HTTPException as exc:
    detail = str(exc.detail)
    check("unconfigured → 503", exc.status_code == 503, f"got {exc.status_code}")
    check("the 503 names every key it accepts, so the fix is obvious",
          all(k in detail for k in ("CHAT_BASE_URL", "GROQ_API_KEY", "XAI_API_KEY", "ANTHROPIC_API_KEY")), detail)
    check("the 503 says offline answers still work", "ffline" in detail, detail)


# ── 3. the Grok call, with the network stubbed out ──────────────────────────
print("\nThe Grok request is shaped the way xAI expects, and the answer is attributed:")

m = load(XAI_API_KEY="xai-test")
sent = {}


class FakeResponse:
    def __init__(self, status_code=200, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload
        self.text = text

    def json(self):
        if self._payload is None:
            raise ValueError("not json")
        return self._payload


def fake_post(url, headers=None, json=None, timeout=None):
    sent.clear()
    sent.update(url=url, headers=headers, body=json, timeout=timeout)
    return FakeResponse(payload={"choices": [{"message": {"content": "  Ready equipment.  "}}]})


import httpx  # noqa: E402
_real_post = httpx.post
httpx.post = fake_post
try:
    answer, model = m._chat_completion("What is NalamMesh?", "CTX BODY", "MO", "hi")
    check("the answer comes back trimmed", answer == "Ready equipment.", repr(answer))
    check("the reported model is the one that answered, not the Claude default",
          model == "grok-4", model)
    check("posts to xAI's chat-completions endpoint",
          sent["url"] == "https://api.x.ai/v1/chat/completions", sent.get("url"))
    check("sends the key as a bearer token",
          sent["headers"]["Authorization"] == "Bearer xai-test", "authorization header wrong")
    roles = [msg["role"] for msg in sent["body"]["messages"]]
    check("sends a system message then a user message", roles == ["system", "user"], str(roles))
    user_msg = sent["body"]["messages"][1]["content"]
    check("the grounding context reaches the model", "CTX BODY" in user_msg, user_msg[:120])
    check("the question reaches the model", "What is NalamMesh?" in user_msg, user_msg[:120])
    check("the requested language reaches the model", "hi" in user_msg, user_msg[:200])
    check("the request carries a timeout, so a hung provider cannot hang the endpoint",
          isinstance(sent["timeout"], float) and sent["timeout"] > 0, str(sent.get("timeout")))
    check("the client's 45s abort is the outer bound, not the inner one",
          sent["timeout"] < 45, str(sent.get("timeout")))

    # ── 4. failures surface their reason ────────────────────────────────────
    print("\nA provider failure keeps its reason instead of becoming 'unavailable':")

    httpx.post = lambda *a, **k: FakeResponse(
        status_code=401, payload=None, text='{"error":"Incorrect API key provided"}'
    )
    try:
        m._chat_completion("q", "c", "MO", "en")
        check("a rejected key surfaces xAI's own message", False, "no exception raised")
    except HTTPException as exc:
        check("a rejected key surfaces xAI's own message",
              exc.status_code == 502 and "Incorrect API key" in str(exc.detail), str(exc.detail))

    httpx.post = lambda *a, **k: FakeResponse(payload={"choices": [{"message": {"content": ""}}]})
    try:
        m._chat_completion("q", "c", "MO", "en")
        check("an empty answer is an error, not a blank chat bubble", False, "no exception raised")
    except HTTPException as exc:
        check("an empty answer is an error, not a blank chat bubble", exc.status_code == 502,
              str(exc.detail))

    httpx.post = lambda *a, **k: FakeResponse(payload={"unexpected": True})
    try:
        m._chat_completion("q", "c", "MO", "en")
        check("an unreadable response is reported, not raised as a KeyError", False,
              "no exception raised")
    except HTTPException as exc:
        check("an unreadable response is reported, not raised as a KeyError",
              exc.status_code == 502, str(exc.detail))

    def boom(*a, **k):
        raise OSError("Name or service not known")

    httpx.post = boom
    try:
        m._chat_completion("q", "c", "MO", "en")
        check("a network failure becomes a 502, never an unhandled traceback", False,
              "no exception raised")
    except HTTPException as exc:
        check("a network failure becomes a 502, never an unhandled traceback",
              exc.status_code == 502 and "service not known" in str(exc.detail), str(exc.detail))
finally:
    httpx.post = _real_post


# ── 4b. the Groq dispatch uses Groq's own constants ─────────────────────────
# The two OpenAI-shaped providers share one call function, so the only thing
# that distinguishes them is which base URL and key the dispatch hands it. That
# is exactly the line a copy-paste gets wrong, and the symptom would be a Groq
# key posted to api.x.ai — an "Incorrect API key" that is nobody's fault.
print("\nA Groq request goes to Groq, with Groq's key:")

m = load(GROQ_API_KEY="gsk_test")
groq_sent = {}


def fake_groq_post(url, headers=None, json=None, timeout=None):
    groq_sent.update(url=url, headers=headers, model=json["model"])
    return FakeResponse(payload={"choices": [{"message": {"content": "ok"}}]})


httpx.post = fake_groq_post
try:
    answer, model = m._chat_completion("q", "c", "MO", "en")
    check("posts to Groq's OpenAI-compatible endpoint",
          groq_sent["url"] == "https://api.groq.com/openai/v1/chat/completions",
          groq_sent.get("url"))
    check("sends the Groq key, not the xAI one",
          groq_sent["headers"]["Authorization"] == "Bearer gsk_test", "wrong key sent")
    check("sends the Groq model", groq_sent["model"] == "openai/gpt-oss-120b",
          groq_sent.get("model"))
    check("the answer is attributed to the Groq model", model == "openai/gpt-oss-120b", model)
finally:
    httpx.post = _real_post

# ── 4c. a model the department hosts itself ─────────────────────────────────
# Data residency: a department that runs its own OpenAI-compatible server
# (vLLM, Ollama, TGI) must be able to keep every question in-house. Configured
# means a base URL and a model; the key is optional on a private network.
print("\nA self-hosted model is used, first, and needs no third-party key:")

m = load(CHAT_BASE_URL="http://10.20.0.5:8000/v1/", CHAT_MODEL="llama-3.3-70b")
check("CHAT_BASE_URL + CHAT_MODEL alone → self-hosted",
      m._resolve_provider() == ("self-hosted", "llama-3.3-70b"), f"got {m._resolve_provider()}")
check("its hosting is reported as self-hosted", m.chat_hosting("self-hosted") == "self-hosted")
check("a third-party provider is reported as external",
      all(m.chat_hosting(p) == "external" for p in ("groq", "grok", "anthropic")))
check("no provider → no hosting claim", m.chat_hosting(None) is None)

m = load(CHAT_BASE_URL="http://10.20.0.5:8000/v1", CHAT_MODEL="llama-3.3-70b", GROQ_API_KEY="gsk_test",
         ANTHROPIC_API_KEY="sk-ant-test")
check("a self-hosted model outranks third-party keys left in the environment",
      m._resolve_provider()[0] == "self-hosted", f"got {m._resolve_provider()}")

m = load(CHAT_BASE_URL="http://10.20.0.5:8000/v1", GROQ_API_KEY="gsk_test")
check("a base URL with no model is not 'configured' — the next provider answers",
      m._resolve_provider()[0] == "groq", f"got {m._resolve_provider()}")

m = load(GROQ_API_KEY="gsk_test", CHAT_PROVIDER="self-hosted")
check("CHAT_PROVIDER=self-hosted with nothing configured → 503, never a silent third-party fallback",
      m._resolve_provider() is None, f"got {m._resolve_provider()}")

m = load(CHAT_BASE_URL="http://10.20.0.5:8000/v1/", CHAT_MODEL="llama-3.3-70b")
local_sent = {}


def fake_local_post(url, headers=None, json=None, timeout=None):
    local_sent.update(url=url, headers=headers, model=json["model"], user=json["messages"][1]["content"])
    return FakeResponse(payload={"choices": [{"message": {"content": "local ok"}}]})


httpx.post = fake_local_post
try:
    answer, model = m._chat_completion("q", "c", "ANM", "en", role_verified=True)
    check("posts to the department's server, trailing slash handled",
          local_sent["url"] == "http://10.20.0.5:8000/v1/chat/completions", local_sent.get("url"))
    check("no Authorization header when no key is set",
          "Authorization" not in local_sent["headers"], str(local_sent["headers"]))
    check("the answer is attributed to the self-hosted model", (answer, model) == ("local ok", "llama-3.3-70b"),
          f"{answer!r} {model!r}")
    check("a verified role is labelled as verified for the model",
          "Worker role: ANM (verified by staff sign-in)" in local_sent["user"], local_sent["user"][-200:])
    m._chat_completion("q", "c", "MO", "en")
    check("an unverified role is labelled self-reported",
          "Worker role: MO (self-reported; not verified by sign-in)" in local_sent["user"], local_sent["user"][-200:])
    m._chat_completion("q", "c", None, "en")
    check("no role is 'unspecified'", "Worker role: unspecified" in local_sent["user"], local_sent["user"][-200:])

    m = load(CHAT_BASE_URL="https://llm.health.example.gov.in/v1", CHAT_MODEL="m", CHAT_API_KEY="local-key")
    m._chat_completion("q", "c", None, "en")
    check("a key, when set, is sent as a bearer token",
          local_sent["headers"].get("Authorization") == "Bearer local-key", str(local_sent["headers"]))
finally:
    httpx.post = _real_post

m = load(GROQ_API_KEY="gsk_test")


# ── 5. the clinical rails survived the widening ─────────────────────────────
print("\nWidening the prompt for questions about the platform kept every clinical rail:")
prompt = m.CHAT_SYSTEM_PROMPT
RAILS = [
    ("no dose, frequency or quantity", "dose"),
    ("never downgrade a triage priority", "lower than what the grounding brief"),
    ("never diagnose", "Never diagnose"),
    ("ground factual claims in CONTEXT", "CONTEXT"),
    ("escalate when unsure", "escalate"),
    ("patients are redirected to a health worker", "family member"),
    ("general knowledge is never passed off as app data", "general knowledge"),
    ("questions about the system itself are answered", "ABOUT THIS SYSTEM"),
]
for label, needle in RAILS:
    check(label, needle in prompt, f"{needle!r} missing from the system prompt")


# ── 6. the scope boundary ───────────────────────────────────────────────────
# The deterministic gate lives client-side in lib/chat/scopeGuard.ts, where it
# stops an off-topic question before it becomes a network call. This endpoint is
# reachable without that gate, so the same rule has to be in the prompt — and it
# has to be phrased as a refusal, not as a preference the model can weigh
# against being helpful.
print("\nThe prompt refuses anything outside NalamMesh and rural public health:")
SCOPE = [
    ("scope is stated as a boundary", "SCOPE"),
    ("the two subjects are named", "rural public healthcare in India"),
    ("everything else is excluded", "Nothing else"),
    ("a partial answer is not a loophole", "Do not answer it partially"),
    ("the 'just this once' framing is pre-empted", "one-off"),
    ("an instruction to ignore the rules is itself declined", "role-play as a different assistant"),
    ("the refusal names what IS covered", "name two or three things it does cover"),
]
for label, needle in SCOPE:
    check(label, needle in prompt, f"{needle!r} missing from the system prompt")

# The clause this replaced invited the model to answer anything at all from
# general knowledge. Leaving it in alongside the scope rule would give the model
# two contradictory instructions, and the helpful one usually wins.
check("the old answer-anything clause is gone",
      "is still worth answering" not in prompt,
      "the prompt still invites general-knowledge answers to unrelated questions")

print("")
if failures:
    print(f"{len(failures)} check(s) FAILED:")
    for f in failures:
        print(f"  - {f}")
    print("")
    sys.exit(1)
print("All checks passed — the provider is chosen by the key that is present, the")
print("answer is attributed to the model that produced it, every provider failure")
print("keeps its reason, the clinical rails survived the wider prompt, and the")
print("prompt refuses anything outside NalamMesh and rural public health.\n")
sys.exit(0)
