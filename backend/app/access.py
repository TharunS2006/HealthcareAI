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
"""

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from fastapi import HTTPException, Request, status

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


def identity_from_request(request: Request) -> Optional[Identity]:
    """The signed-in identity behind a request's bearer token, or None."""
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    secret = auth_secret()
    if not secret:
        return None
    return verify_token(auth[7:].strip(), secret)


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
