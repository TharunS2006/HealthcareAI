"""
Request limits and response headers shared by both deployments.

- BodySizeLimit refuses a request body over MAX_REQUEST_BYTES (default 2 MB)
  with 413, counting what actually arrives rather than trusting the
  Content-Length header, so a chunked upload cannot slip past it. A patient
  record with its visit history is a few kilobytes; nothing a device sends
  is near this, and a signed-in caller cannot fill the disk with one request.
- security_headers marks every response nosniff, unframeable and
  referrer-free, and every /api/v1 response no-store: identified records must
  not be kept by a browser cache or a proxy on the way.
- API_DOCS=off hides the generated API documentation.
"""

import json
import os

from fastapi import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# Imported for its side effect: backend/.env is loaded before the reads below.
from . import env  # noqa: F401


def _max_bytes() -> int:
    try:
        value = int(os.environ.get("MAX_REQUEST_BYTES", "").strip() or 2 * 1024 * 1024)
    except ValueError:
        value = 2 * 1024 * 1024
    return value if value > 0 else 2 * 1024 * 1024


MAX_REQUEST_BYTES = _max_bytes()


def api_docs_enabled() -> bool:
    return os.environ.get("API_DOCS", "on").strip().lower() not in ("off", "false", "0", "no")


class _TooLarge(HTTPException):
    """
    An HTTPException on purpose: FastAPI turns any other error raised while it
    reads a body into a 400, which would hide what happened. As a 413 it
    reaches the caller as one, and BodySizeLimit catches it if it ever
    escapes a non-FastAPI app.
    """

    def __init__(self, limit: int):
        super().__init__(status_code=413, detail=f"Request body larger than {limit} bytes")


class BodySizeLimit:
    """ASGI middleware: 413 for a request body larger than the limit."""

    def __init__(self, app: ASGIApp, max_bytes: int = 0):
        self.app = app
        self.max_bytes = max_bytes or MAX_REQUEST_BYTES

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = dict(scope.get("headers") or []).get(b"content-length")
        if declared is not None:
            try:
                if int(declared) > self.max_bytes:
                    await self._refuse(send)
                    return
            except ValueError:
                pass

        received = 0
        started = False

        async def counted_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _TooLarge(self.max_bytes)
            return message

        async def tracked_send(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, counted_receive, tracked_send)
        except _TooLarge:
            if not started:
                await self._refuse(send)

    async def _refuse(self, send: Send) -> None:
        body = json.dumps({"detail": f"Request body larger than {self.max_bytes} bytes"}).encode()
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
        })
        await send({"type": "http.response.body", "body": body})


async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    if request.url.path.startswith("/api/v1/"):
        response.headers["Cache-Control"] = "no-store"
    return response
