"""
District service role checks — `npm run verify:access-api`

Drives the FastAPI app through its HTTP layer (TestClient) against a
throwaway database and checks that every data route applies the role rules
exported from lib/auth/permissions.ts:

  1. identity  no headers → 401 on every data route; health and chat stay open
  2. roles     the full record store is DHO / Super Admin only; analytics
               likewise; uploads need a signed-in staff role
  3. scope     a facility reads only its own pre-arrival board; district roles
               read any
  4. sync      the exported permissions.json matches what the service loaded
"""

import json
import os
import sys
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/verify_access.db"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

from app.access import DISTRICT_WIDE, ROLE_PERMISSIONS  # noqa: E402
from app.main import app  # noqa: E402

failures = []


def check(label, condition, detail=""):
    print(f" {'PASS' if condition else 'FAIL'} {label}{'' if condition else f' — {detail}'}")
    if not condition:
        failures.append(label)


def who(user, role, facility=None):
    headers = {"x-nalammesh-user": user, "x-nalammesh-role": role}
    if facility:
        headers["x-nalammesh-facility"] = facility
    return headers


ANM = who("u-anm-kothi", "ANM", "sc-kothi")
MO = who("u-mo-bhamragad", "MO", "phc-bhamragad")
HA_DH = who("u-ha-dh", "HOSPITAL_ADMIN", "dh-district")
DHO = who("u-dho", "DHO")
SA = who("u-sa", "SUPER_ADMIN")

PATIENT = {
    "id": "p-access-1", "name": "Access Check", "age": 40, "gender": "F",
    "facility_id": "sc-kothi", "triage_priority": "RED",
    "updated_at": "2026-09-23T10:00:00+00:00", "payload": {"id": "p-access-1"},
}

with TestClient(app) as client:
    print("\n1. IDENTITY")
    for method, path in [
        ("get", "/api/v1/store"),
        ("get", "/api/v1/records/incoming?facility_id=dh-district"),
        ("get", "/api/v1/district/summary"),
        ("get", "/api/v1/facilities"),
    ]:
        r = getattr(client, method)(path)
        check(f"{method.upper()} {path} without identity → 401", r.status_code == 401, str(r.status_code))
    r = client.post("/api/v1/records/patients", json=PATIENT)
    check("uploading a record without identity → 401 (the device keeps it queued)", r.status_code == 401, str(r.status_code))
    check("/health stays public", client.get("/health").status_code == 200)
    r = client.post("/api/v1/chat", json={"question": "hello"})
    check("the citizen assistant is not behind sign-in", r.status_code != 401 and r.status_code != 403, str(r.status_code))
    r = client.get("/api/v1/store", headers=who("x", "NOT_A_ROLE"))
    check("an unknown role is treated as no identity (401)", r.status_code == 401, str(r.status_code))

    print("\n2. ROLES")
    check("an ANM cannot read the full record store (403)", client.get("/api/v1/store", headers=ANM).status_code == 403)
    check("a Medical Officer cannot either (403)", client.get("/api/v1/store", headers=MO).status_code == 403)
    check("the DHO can (200)", client.get("/api/v1/store", headers=DHO).status_code == 200)
    check("Super Admin can (200)", client.get("/api/v1/store", headers=SA).status_code == 200)
    check("district analytics are DHO-only among clinical roles",
          client.get("/api/v1/district/summary", headers=MO).status_code == 403
          and client.get("/api/v1/district/summary", headers=DHO).status_code == 200)
    r = client.post("/api/v1/records/patients", json=PATIENT, headers=ANM)
    check("a signed-in ANM can upload a record (202)", r.status_code == 202, f"{r.status_code} {r.text[:120]}")

    print("\n3. SCOPE")
    check("a PHC reads its own pre-arrival board (200)",
          client.get("/api/v1/records/incoming?facility_id=phc-bhamragad", headers=MO).status_code == 200)
    check("...but not the District Hospital's (403)",
          client.get("/api/v1/records/incoming?facility_id=dh-district", headers=MO).status_code == 403)
    check("the DH bed manager reads the DH board (200)",
          client.get("/api/v1/records/incoming?facility_id=dh-district", headers=HA_DH).status_code == 200)
    check("the DHO reads any facility's board (200)",
          client.get("/api/v1/records/incoming?facility_id=phc-bhamragad", headers=DHO).status_code == 200)
    check("an ANM has no pre-arrival board (403)",
          client.get("/api/v1/records/incoming?facility_id=sc-kothi", headers=ANM).status_code == 403)

print("\n4. SYNC WITH lib/auth/permissions.ts")
exported = json.loads(open(os.path.join(os.path.dirname(__file__), "..", "app", "permissions.json")).read())
check("the service loaded the exported table", ROLE_PERMISSIONS == {r: set(p) for r, p in exported["roles"].items()})
check("six roles, two district-wide", len(ROLE_PERMISSIONS) == 6 and DISTRICT_WIDE == {"DHO", "SUPER_ADMIN"})

print("\nAll district-service access checks passed.\n" if not failures else f"\n{len(failures)} check(s) FAILED.\n")
sys.exit(1 if failures else 0)
