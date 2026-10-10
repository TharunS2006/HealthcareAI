"""
District service hardening — `npm run verify:backend-hardening`

Through the HTTP layer (TestClient), against a throwaway database:

  1. access log   every /api/v1 request is recorded with the user, role and
                  posting from their token — refused requests too — and an
                  upload names the record it carried; only audit:view reads it
  2. body size    a body over the limit is refused with 413, whether or not it
                  declares its length, before any route reads it
  3. headers      responses are nosniff, unframeable, referrer-free, and
                  /api/v1 responses are never cached
  4. docs         API_DOCS=off hides /docs, /redoc and /openapi.json
  5. revocation   with NALAMMESH_RELAY_URL set, a token whose user the relay
                  no longer accepts (deactivated, moved, re-roled) is refused
                  here too; an unreachable relay is not a refusal unless
                  NALAMMESH_RELAY_CHECK=strict; answers are cached
"""

import os
import subprocess
import sys
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/verify_hardening.db"
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    import dotenv

    dotenv.load_dotenv = lambda *a, **k: False
except ImportError:
    pass
for name in ("API_DOCS", "MAX_REQUEST_BYTES"):
    os.environ.pop(name, None)

from session_tokens import TEST_SECRET, bearer  # noqa: E402

os.environ["NALAMMESH_AUTH_SECRET"] = TEST_SECRET

from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session, select  # noqa: E402

import app.main as district  # noqa: E402
from app.hardening import MAX_REQUEST_BYTES  # noqa: E402
from app.models import AccessLog  # noqa: E402

failures = []


def check(label, condition, detail=""):
    print(f" {'PASS' if condition else 'FAIL'} {label}{'' if condition else f' — {detail}'}")
    if not condition:
        failures.append(label)


def log_rows():
    with Session(district.engine) as s:
        return s.exec(select(AccessLog).order_by(AccessLog.id)).all()


ANM = bearer("u-anm-kothi", "ANM", "sc-kothi")
MO = bearer("u-mo-dh", "MO", "dh-district")
DHO = bearer("u-dho", "DHO")

PATIENT = {
    "id": "p-hard-1", "name": "Hardening Check", "age": 30, "gender": "F",
    "facility_id": "sc-kothi", "triage_priority": "RED",
    "updated_at": "2026-10-01T10:00:00+00:00", "payload": {"id": "p-hard-1", "name": "Hardening Check"},
}
REFERRAL = {
    "id": "r-hard-1", "patient_id": "p-hard-1", "from_facility_id": "sc-kothi", "to_facility_id": "dh-district",
    "status": "INITIATED", "priority": "RED", "reason": "check", "clinical_summary": None,
    "transport_mode": "AMBULANCE_108", "eta_minutes": 40,
    "raised_at": "2026-10-01T10:00:00+00:00", "updated_at": "2026-10-01T10:00:00+00:00",
    "payload": {"id": "r-hard-1", "patientId": "p-hard-1"},
}

with TestClient(district.app) as client:
    print("\n1. ACCESS LOG")
    r = client.post("/api/v1/records/patients", json=PATIENT, headers=ANM)
    check("an ANM's upload is accepted", r.status_code == 202, f"{r.status_code} {r.text[:200]}")
    client.post("/api/v1/records/referrals", json=REFERRAL, headers=ANM)
    rows = log_rows()
    up = [x for x in rows if x.path == "/api/v1/records/patients"]
    check("the upload is logged with who sent it", up and up[-1].user_id == "u-anm-kothi" and up[-1].role == "ANM"
          and up[-1].facility_id == "sc-kothi", str([(x.user_id, x.role, x.facility_id) for x in up]))
    check("…and which record it carried", up and up[-1].detail == "patient p-hard-1", str([x.detail for x in up]))
    ref = [x for x in rows if x.path == "/api/v1/records/referrals"]
    check("a referral upload names the referral and its patient",
          ref and ref[-1].detail == "referral r-hard-1 for patient p-hard-1", str([x.detail for x in ref]))

    r = client.get("/api/v1/records/incoming?facility_id=dh-district", headers=MO)
    check("the receiving MO reads the pre-arrival board", r.status_code == 200 and r.json()["count"] == 1, r.text[:200])
    rows = log_rows()
    read = [x for x in rows if x.path == "/api/v1/records/incoming"]
    check("the read is logged: who, which facility, which patients", read and read[-1].user_id == "u-mo-dh"
          and "facility_id=dh-district" in (read[-1].query or "") and "p-hard-1" in (read[-1].detail or ""),
          str([(x.user_id, x.query, x.detail) for x in read]))

    client.get("/api/v1/records/incoming?facility_id=dh-district", headers=ANM)
    client.get("/api/v1/store")
    rows = log_rows()
    refused = [x for x in rows if x.status in (401, 403)]
    check("a refused request from a valid token is logged with the token's user",
          any(x.user_id == "u-anm-kothi" and x.status == 403 for x in refused), str([(x.user_id, x.status) for x in refused]))
    check("an anonymous attempt is logged too", any(x.user_id is None and x.status == 401 and x.path == "/api/v1/store" for x in refused))

    client.post("/api/v1/chat", json={"question": "hi", "context": "x"})
    client.get("/health")
    check("the assistant and the health probe are not logged (they carry no records)",
          not any(x.path in ("/api/v1/chat", "/health") for x in log_rows()))

    r = client.get("/api/v1/access-log", headers=ANM)
    check("an ANM cannot read the access log", r.status_code == 403, str(r.status_code))
    r = client.get("/api/v1/access-log?limit=5", headers=DHO)
    check("the DHO can, newest first", r.status_code == 200 and r.json()["count"] == 5
          and r.json()["entries"][0]["path"] == "/api/v1/access-log", r.text[:300])
    r = client.get("/api/v1/access-log?user_id=u-mo-dh", headers=DHO)
    check("…and filter by user", r.status_code == 200 and all(e["user_id"] == "u-mo-dh" for e in r.json()["entries"])
          and r.json()["count"] >= 1, r.text[:300])

    print("\n2. BODY SIZE")
    big = b"{" + b" " * (MAX_REQUEST_BYTES + 10) + b"}"
    r = client.post("/api/v1/records/patients", content=big, headers={**ANM, "content-type": "application/json"})
    check(f"a body over {MAX_REQUEST_BYTES} bytes is refused with 413", r.status_code == 413, str(r.status_code))

    def chunks():
        for _ in range(MAX_REQUEST_BYTES // 65536 + 2):
            yield b" " * 65536

    r = client.post("/api/v1/records/patients", content=chunks(), headers={**ANM, "content-type": "application/json"})
    check("…also when it is sent in chunks without a declared length", r.status_code == 413, str(r.status_code))
    r = client.post("/api/v1/records/patients", json={**PATIENT, "id": "p-hard-2"}, headers=ANM)
    check("an ordinary upload still goes through", r.status_code == 202, str(r.status_code))

    print("\n3. HEADERS")
    r = client.get("/api/v1/records/incoming?facility_id=dh-district", headers=MO)
    h = r.headers
    check("no-store on identified records", h.get("cache-control") == "no-store", str(h.get("cache-control")))
    check("nosniff", h.get("x-content-type-options") == "nosniff")
    check("cannot be framed", h.get("x-frame-options") == "DENY")
    check("no referrer", h.get("referrer-policy") == "no-referrer")
    check("errors carry the headers too", client.get("/api/v1/store").headers.get("cache-control") == "no-store")

    print("\n4. DOCS")
    check("docs are on by default (a developer's machine)", client.get("/docs").status_code == 200)

probe = subprocess.run(
    [sys.executable, "-c",
     "import dotenv; dotenv.load_dotenv=lambda *a,**k: False\n"
     "from fastapi.testclient import TestClient\n"
     "import app.main as m\n"
     "with TestClient(m.app) as c:\n"
     "    print(c.get('/docs').status_code, c.get('/openapi.json').status_code, c.get('/redoc').status_code, c.get('/health').status_code)"],
    cwd=BACKEND, capture_output=True, text=True,
    env={**os.environ, "API_DOCS": "off", "DATABASE_URL": f"sqlite:///{_tmp}/docs_off.db"},
)
check("API_DOCS=off hides /docs, /openapi.json and /redoc (and the service still answers)",
      probe.stdout.strip() == "404 404 404 200", f"{probe.stdout!r} {probe.stderr[-300:]!r}")

print("\n5. REVOCATION")
import httpx  # noqa: E402
from app import access  # noqa: E402

calls = []


class _Resp:
    def __init__(self, code):
        self.status_code = code


def relay_says(code):
    def fake_get(url, headers=None, timeout=None):
        calls.append((url, headers.get("Authorization", "")))
        if code is None:
            raise httpx.ConnectError("relay down")
        return _Resp(code)
    return fake_get


real_get = httpx.get
access.RELAY_URL = "http://relay.test"
try:
    with TestClient(district.app) as client:
        httpx.get = relay_says(401)
        access._relay_cache.clear()
        r = client.get("/api/v1/records/incoming?facility_id=dh-district", headers=bearer("u-gone", "MO", "dh-district"))
        check("a user the relay no longer accepts is refused here (401)", r.status_code == 401, str(r.status_code))
        check("…the relay was asked, with that token", calls and calls[-1][0] == "http://relay.test/api/auth/me"
              and calls[-1][1].startswith("Bearer "), str(calls[-1:]))
        rows = log_rows()
        check("…and the refusal is logged under the user the token names",
              any(x.user_id == "u-gone" and x.status == 401 for x in rows))

        httpx.get = relay_says(200)
        access._relay_cache.clear()
        token = bearer("u-still", "MO", "dh-district")
        n = len(calls)
        r1 = client.get("/api/v1/records/incoming?facility_id=dh-district", headers=token)
        r2 = client.get("/api/v1/records/incoming?facility_id=dh-district", headers=token)
        check("a user the relay accepts is admitted", r1.status_code == 200 and r2.status_code == 200, f"{r1.status_code} {r2.status_code}")
        check("…and the answer is cached (one relay call for two requests)", len(calls) == n + 1, str(len(calls) - n))

        httpx.get = relay_says(None)
        access._relay_cache.clear()
        r = client.get("/api/v1/records/incoming?facility_id=dh-district", headers=bearer("u-x", "MO", "dh-district"))
        check("an unreachable relay does not lock clinicians out (default)", r.status_code == 200, str(r.status_code))
        access.RELAY_CHECK_STRICT = True
        access._relay_cache.clear()
        r = client.get("/api/v1/records/incoming?facility_id=dh-district", headers=bearer("u-y", "MO", "dh-district"))
        check("…but does with NALAMMESH_RELAY_CHECK=strict", r.status_code == 401, str(r.status_code))
finally:
    httpx.get = real_get
    access.RELAY_URL = ""
    access.RELAY_CHECK_STRICT = False
    access._relay_cache.clear()

print("")
if failures:
    print(f"{len(failures)} check(s) FAILED:")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("All checks passed — every access to identified records is logged, oversized bodies are refused,")
print("and record responses are never cached.\n")
