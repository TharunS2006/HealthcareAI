"""
What stands between the public internet and the cloud assistant's API key.

POST /api/v1/chat is open to visitors as well as staff — the widget answers
both — so it cannot simply demand a sign-in. Left as it was, it was a free,
unmetered model proxy: any script could post a long "context" and a question
in a loop and spend the department's key. Three checks close that, all here so
the district service (app/main.py) and the assistant-only deploy (api/index.py)
apply the same rules:

  1. Size. The request schema caps the question and the grounding brief
     (app/schemas.py), so one request cannot carry a novel.
  2. Rate. Every caller gets a per-minute and a per-day allowance, keyed by
     their signed-in user when the request carries a relay session token and by
     network address otherwise; a per-process daily ceiling bounds the total no
     matter how many addresses an abuser has. Limits are in memory: a restart
     or a second worker starts its own count, which bounds cost per process
     rather than exactly. The provider account's own spending cap is the hard
     backstop and should always be set.
  3. Who. CHAT_REQUIRE_SIGN_IN=true restricts the cloud layer to staff with a
     relay session token; visitors still get every offline answer.

It also strips what looks like a personal identifier — mobile number, Aadhaar,
ABHA number or address, email — out of the question before it can reach a
model hosted outside the department. The widget does the same on the device
(lib/chat/redact.ts); this copy covers a caller that is not the widget. Both
are tested against scripts/fixtures/redaction-cases.json.
"""

import os
import re
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Callable, Optional, Tuple

from fastapi import HTTPException, Request, status

# Imported for its side effect: backend/.env must be loaded before the
# os.environ reads below, or a limit set in that file reads as absent.
from . import env  # noqa: F401
from .access import Identity, auth_secret, identity_from_request


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return max(0, int(raw))
    except ValueError:
        print(f"WARNING: {name}={raw!r} is not a whole number — using {default}.", flush=True)
        return default


def _flag_env(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


# ─────────────────────────── identifiers ───────────────────────────

# A digit is an ASCII digit or a Devanagari one (०-९): Hindi and Marathi
# keyboards type the latter, and a mobile number in either script is the same
# number. Spelled out rather than left to \d, which means something different
# in Python (any Unicode digit) and in JavaScript (ASCII only).
_D = "[0-9\u0966-\u096F]"
_D29 = "[2-9\u0968-\u096F]"
_D69 = "[6-9\u096C-\u096F]"
_NOT_AFTER_DIGIT = f"(?<!{_D})"
_NOT_BEFORE_DIGIT = f"(?!{_D})"

# Order matters: the longer numbers go first, so a 14-digit ABHA number is
# removed whole rather than leaving its tail to look like a phone number. A
# 12-digit run starting 91 could be an Aadhaar or a mobile written with the
# country code; it is removed either way, under whichever label matches first.
_REDACTIONS: Tuple[Tuple[str, "re.Pattern[str]"], ...] = (
    # ABHA address (name@abdm, name@sbx) and ordinary email addresses.
    ("email or ABHA address", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*")),
    # Mobile written with +91: unambiguous, so it goes before the ID numbers.
    ("phone number", re.compile(f"\\+91[ -]?{_D69}{_D}{{4}}[ -]?{_D}{{5}}{_NOT_BEFORE_DIGIT}")),
    # ABHA number: 14 digits, usually written 12-3456-7890-1234.
    ("ABHA number", re.compile(
        f"{_NOT_AFTER_DIGIT}{_D}{{2}}[ -]?{_D}{{4}}[ -]?{_D}{{4}}[ -]?{_D}{{4}}{_NOT_BEFORE_DIGIT}")),
    # Aadhaar: 12 digits, first digit 2-9, usually written in groups of four.
    ("Aadhaar number", re.compile(
        f"{_NOT_AFTER_DIGIT}{_D29}{_D}{{3}}[ -]?{_D}{{4}}[ -]?{_D}{{4}}{_NOT_BEFORE_DIGIT}")),
    # Indian mobile: an optional trunk 0, then ten digits starting 6-9.
    ("phone number", re.compile(
        f"{_NOT_AFTER_DIGIT}[0\u0966]?{_D69}{_D}{{4}}[ -]?{_D}{{5}}{_NOT_BEFORE_DIGIT}")),
    # Anything else that is nine or more digits in a row is an identifier of
    # some kind (MCTS/RCH, ration card, hospital number); no vital sign, dose,
    # date or count a health worker would type is that long.
    ("ID number", re.compile(f"{_NOT_AFTER_DIGIT}{_D}{{9,}}{_NOT_BEFORE_DIGIT}")),
)


def redact_identifiers(text: str) -> Tuple[str, int]:
    """The text with personal identifiers replaced, and how many were replaced."""
    removed = 0
    for label, pattern in _REDACTIONS:
        text, n = pattern.subn(f"[{label} removed]", text)
        removed += n
    return text, removed


# ─────────────────────────── rate limits ───────────────────────────

@dataclass
class _Bucket:
    minute: list
    day_started: float
    day_count: int


class ChatRateLimiter:
    """
    Per-caller allowances plus a ceiling for the whole process.

    A limit of 0 switches that limit off. `clock` is injectable so the verify
    script can move time forward instead of sleeping.
    """

    MAX_TRACKED = 10_000
    DAY = 86_400.0

    def __init__(self, per_minute: int, per_day: int, global_per_day: int,
                 clock: Callable[[], float] = time.monotonic):
        self.per_minute = per_minute
        self.per_day = per_day
        self.global_per_day = global_per_day
        self._clock = clock
        self._lock = threading.Lock()
        self._buckets: "OrderedDict[str, _Bucket]" = OrderedDict()
        self._global_started = clock()
        self._global_count = 0

    def hit(self, key: str) -> Optional[int]:
        """Record one request for `key`. None if allowed, else seconds to wait."""
        now = self._clock()
        with self._lock:
            if now - self._global_started >= self.DAY:
                self._global_started, self._global_count = now, 0
            if self.global_per_day and self._global_count >= self.global_per_day:
                return max(1, int(self._global_started + self.DAY - now))

            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = _Bucket(minute=[], day_started=now, day_count=0)
                self._buckets[key] = bucket
                while len(self._buckets) > self.MAX_TRACKED:
                    self._buckets.popitem(last=False)
            self._buckets.move_to_end(key)

            if now - bucket.day_started >= self.DAY:
                bucket.day_started, bucket.day_count = now, 0
            bucket.minute = [t for t in bucket.minute if now - t < 60.0]

            if self.per_day and bucket.day_count >= self.per_day:
                return max(1, int(bucket.day_started + self.DAY - now))
            if self.per_minute and len(bucket.minute) >= self.per_minute:
                return max(1, int(bucket.minute[0] + 60.0 - now) + 1)

            bucket.minute.append(now)
            bucket.day_count += 1
            self._global_count += 1
            return None


RATE_PER_MINUTE = _int_env("CHAT_RATE_PER_MINUTE", 10)
RATE_PER_DAY = _int_env("CHAT_RATE_PER_DAY", 200)
GLOBAL_PER_DAY = _int_env("CHAT_GLOBAL_PER_DAY", 5000)
REQUIRE_SIGN_IN = _flag_env("CHAT_REQUIRE_SIGN_IN")

# Where the caller's address comes from. Empty (the default) means the TCP
# peer, which is right for uvicorn on a LAN — run uvicorn with
# --proxy-headers --forwarded-allow-ips=<proxy> behind a reverse proxy and it
# rewrites the peer itself. Set a header name only when the host in front sets
# that header and overwrites any value the client sent (Vercel does this for
# x-real-ip; api/index.py defaults to it there). A header the client controls
# would let each request claim a fresh address and walk past the limit.
CLIENT_IP_HEADER = os.environ.get("CHAT_CLIENT_IP_HEADER", "").strip().lower()

limiter = ChatRateLimiter(RATE_PER_MINUTE, RATE_PER_DAY, GLOBAL_PER_DAY)


def client_address(request: Request, header: Optional[str] = None) -> str:
    name = CLIENT_IP_HEADER if header is None else header
    if name:
        value = request.headers.get(name, "").split(",")[0].strip()
        if value:
            return value
    return request.client.host if request.client else "unknown"


@dataclass(frozen=True)
class ChatCaller:
    """Who is asking: a verified staff identity, or None for a visitor."""

    identity: Optional[Identity]


def chat_access(request: Request) -> ChatCaller:
    """FastAPI dependency for POST /api/v1/chat: sign-in policy, then rate limit."""
    who = identity_from_request(request)
    if who is None and REQUIRE_SIGN_IN:
        if not auth_secret():
            # A setting that can never be satisfied should say so, not answer
            # every request with a sign-in error nobody can fix by signing in.
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "CHAT_REQUIRE_SIGN_IN is set but NALAMMESH_AUTH_SECRET is not, so no "
                "session token can be checked. Set the relay's secret on this service.",
            )
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "The cloud assistant answers signed-in staff only on this deployment. "
            "Send the session token as Authorization: Bearer <token>.",
        )

    key = f"user:{who.user_id}" if who else f"addr:{client_address(request)}"
    retry_after = limiter.hit(key)
    if retry_after is not None:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many questions to the cloud assistant — try again later. "
            "Offline answers still work.",
            headers={"Retry-After": str(retry_after)},
        )
    return ChatCaller(identity=who)
