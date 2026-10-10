"""
Role checks for the district service — the same rules the app and the mesh
relay apply, read from the table exported from lib/auth/permissions.ts
(backend/app/permissions.json; regenerate with `npm run export:permissions`).

Identity is the session token the mesh relay issued when the user signed in
with their PIN (server/relay/auth.ts): `Authorization: Bearer <token>`, an
HS256 JWT naming the user, role and posting. It is verified here with the same
secret — NALAMMESH_AUTH_SECRET, or on a developer machine the shared
`.nalammesh-dev-secret` at the repository root — so the role a request acts
under is the one its user signed in as, not one it claims.

Checks are attached as route dependencies (`dependencies=[...]`), not as
function parameters, so the endpoint functions keep their signatures and the
verify scripts that call them directly still work.

Revocation. A token is good for 12 hours. The relay re-reads the staff
directory on every request, so a user the Super Admin deactivates, moves or
re-roles is refused there at once; this service has no directory of its own.
With NALAMMESH_RELAY_URL set, it asks the relay (GET /api/auth/me) whether a
token's user is still the user it names, caching each answer for a minute
(NALAMMESH_RELAY_CHECK_SECONDS; 0 asks on every request).
The relay's "no" is final. A relay that cannot be reached is not treated as
a "no" — the token's signature and expiry still stand — so a relay outage
does not lock clinicians out of the pre-arrival board; set
NALAMMESH_RELAY_CHECK=strict to refuse instead.
"""

import base64
import hashlib
import hmac
import json
import os
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from fastapi import HTTPException, Request, status

# Imported for its side effect: backend/.env is loaded before the reads below.
from . import env  # noqa: F401

_TABLE = json.loads((Path(__file__).parent / "permissions.json").read_text())
ROLE_PERMISSIONS: dict[str, set[str]] = {role: set(perms) for role, perms in _TABLE["roles"].items()}
DISTRICT_WIDE: set[str] = set(_TABLE["district_wide"])


@dataclass(frozen=True)
class Identity:
    user_id: str
    role: str
    facility_id: Optional[str]


_DEV_SECRET_FILE = Path(__file__).resolve().parents[2] / ".nalammesh-dev-secret"


def auth_secret() -> Optional[str]:
    """The relay's signing secret — never invented here: this service only verifies."""
    configured = os.environ.get("NALAMMESH_AUTH_SECRET", "").strip()
    if configured:
        return configured if len(configured) >= 32 else None
    try:
        return _DEV_SECRET_FILE.read_text().strip() or None
    except OSError:
        return None


def _b64decode(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def verify_token(token: str, secret: str, now: Optional[float] = None) -> Optional[Identity]:
    """The identity in a valid, unexpired HS256 token — None for anything else."""
    parts = token.split(".")
    if len(parts) != 3:
        return None
    header, payload, signature = parts
    expected = hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    try:
        if not hmac.compare_digest(expected, _b64decode(signature)):
            return None
        if json.loads(_b64decode(header)).get("alg") != "HS256":
            return None
        claims = json.loads(_b64decode(payload))
    except (ValueError, TypeError):
        return None
    if not isinstance(claims, dict) or not isinstance(claims.get("sub"), str) or claims.get("role") not in ROLE_PERMISSIONS:
        return None
    exp = claims.get("exp")
    if not isinstance(exp, (int, float)) or exp <= (now if now is not None else time.time()):
        return None
    fac = claims.get("fac")
    return Identity(user_id=claims["sub"], role=claims["role"], facility_id=fac if isinstance(fac, str) else None)


RELAY_URL = os.environ.get("NALAMMESH_RELAY_URL", "").strip().rstrip("/")
RELAY_CHECK_STRICT = os.environ.get("NALAMMESH_RELAY_CHECK", "").strip().lower() == "strict"


def _cache_seconds() -> float:
    """How long the relay's answer about a token is reused: NALAMMESH_RELAY_CHECK_SECONDS, default 60."""
    try:
        value = float(os.environ.get("NALAMMESH_RELAY_CHECK_SECONDS", "").strip() or 60)
    except ValueError:
        return 60.0
    return value if value >= 0 else 60.0


# The longest a deactivated, moved or re-roled account keeps reading records here.
_RELAY_CACHE_SECONDS = _cache_seconds()
_relay_cache: "OrderedDict[str, tuple[float, bool]]" = OrderedDict()
_relay_lock = threading.Lock()


def _relay_still_accepts(token: str) -> bool:
    """Does the relay still accept this token's user? True when no relay is configured."""
    if not RELAY_URL:
        return True
    key = hashlib.sha256(token.encode()).hexdigest()
    now = time.monotonic()
    with _relay_lock:
        hit = _relay_cache.get(key)
        if hit and now - hit[0] < _RELAY_CACHE_SECONDS:
            return hit[1]
    try:
        import httpx

        response = httpx.get(f"{RELAY_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"}, timeout=3.0)
        if response.status_code == 200:
            accepted = True
        elif response.status_code in (401, 403):
            accepted = False
        else:
            accepted = not RELAY_CHECK_STRICT
    except Exception:  # unreachable relay: see the module note
        accepted = not RELAY_CHECK_STRICT
    with _relay_lock:
        _relay_cache[key] = (now, accepted)
        _relay_cache.move_to_end(key)
        while len(_relay_cache) > 5000:
            _relay_cache.popitem(last=False)
    return accepted


def identity_from_request(request: Request, check_relay: bool = True) -> Optional[Identity]:
    """
    The signed-in identity behind a request's bearer token, or None.

    check_relay=False skips the revocation check — for the access log, which
    records who a token names even when that user has since been refused.
    """
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    secret = auth_secret()
    if not secret:
        return None
    token = auth[7:].strip()
    who = verify_token(token, secret)
    if who is None or (check_relay and not _relay_still_accepts(token)):
        return None
    return who


def require(permission: str, *, facility_query: Optional[str] = None) -> Callable[[Request], Identity]:
    """
    A dependency that admits only roles holding `permission`.

    With `facility_query`, the request's query parameter of that name must be
    the caller's own facility unless their role is district-wide — a PHC reads
    its own pre-arrival board, not the District Hospital's.
    """

    def dependency(request: Request) -> Identity:
        who = identity_from_request(request)
        if who is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sign in: send the session token as Authorization: Bearer <token>",
            )
        if permission not in ROLE_PERMISSIONS[who.role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{who.role} does not hold {permission}",
            )
        if facility_query and who.role not in DISTRICT_WIDE:
            requested = request.query_params.get(facility_query)
            if requested and requested != who.facility_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only your own facility's records are available to your role",
                )
        return who

    return dependency
