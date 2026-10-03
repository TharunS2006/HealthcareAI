"""
Session tokens for the verify scripts — minted exactly as the mesh relay mints
them (server/relay/auth.ts signToken), so the district service is tested
against the real format, not a test-only shortcut.
"""

import base64
import hashlib
import hmac
import json
import time

TEST_SECRET = "verify-scripts-secret-" + "x" * 24  # 46 characters: long enough to be accepted


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def mint(user: str, role: str, facility=None, secret: str = TEST_SECRET, ttl: int = 3600, now=None) -> str:
    iat = int(now if now is not None else time.time())
    header = _b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = _b64(json.dumps({"sub": user, "role": role, "fac": facility, "name": user, "iat": iat, "exp": iat + ttl},
                              separators=(",", ":")).encode())
    signature = _b64(hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{signature}"


def bearer(user: str, role: str, facility=None, **kwargs) -> dict:
    return {"Authorization": f"Bearer {mint(user, role, facility, **kwargs)}"}
