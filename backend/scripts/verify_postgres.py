"""
District service on PostgreSQL — `npm run verify:postgres`

Production runs the district service on PostgreSQL (requirements-postgres.txt);
every other suite uses SQLite. Timezone handling, JSON payloads, Unicode names
and fractional ages are exactly where two databases disagree, so this suite
drives the real HTTP layer against a real PostgreSQL:

  tables are created at startup · uploads, the stale-replay rule and the
  pre-arrival board · the Data Inspector dump · the access log

It needs TEST_POSTGRES_URL, e.g.
  postgresql+psycopg://postgres@127.0.0.1:5432/nalammesh_test
and skips (exit 0) without it, saying so. CI provides one. The database name
must contain "test": the suite drops and recreates every table.
"""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

URL = os.environ.get("TEST_POSTGRES_URL", "").strip()
if not URL:
    print("SKIP verify:postgres — set TEST_POSTGRES_URL to a throwaway PostgreSQL database to run it.")
    sys.exit(0)
if "test" not in URL.rsplit("/", 1)[-1]:
    print(f"REFUSED: {URL!r} does not name a test database; this suite drops every table.")
    sys.exit(1)

os.environ["DATABASE_URL"] = URL
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    import dotenv

    dotenv.load_dotenv = lambda *a, **k: False
except ImportError:
    pass

from session_tokens import TEST_SECRET, bearer  # noqa: E402

os.environ["NALAMMESH_AUTH_SECRET"] = TEST_SECRET

from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

import app.main as district  # noqa: E402

failures = []


def check(label, condition, detail=""):
    print(f" {'PASS' if condition else 'FAIL'} {label}{'' if condition else f' — {detail}'}")
    if not condition:
        failures.append(label)


check("the service is on PostgreSQL", district.engine.dialect.name == "postgresql", district.engine.dialect.name)
SQLModel.metadata.drop_all(district.engine)

ANM = bearer("u-anm", "ANM", "sc-kothi")
MO = bearer("u-mo", "MO", "dh-district")
DHO = bearer("u-dho", "DHO")
NOW = datetime(2026, 10, 1, 10, 0, tzinfo=timezone.utc)


def patient(pid, name, updated, age=30):
    return {"id": pid, "name": name, "age": age, "gender": "F", "facility_id": "sc-kothi", "triage_priority": "RED",
            "updated_at": updated.isoformat(), "payload": {"id": pid, "name": name, "visits": [{"note": "प्रसूती"}]}}


def referral(rid, pid, raised):
    return {"id": rid, "patient_id": pid, "from_facility_id": "sc-kothi", "to_facility_id": "dh-district",
            "status": "INITIATED", "priority": "RED", "reason": "रक्तदाब जास्त", "clinical_summary": None,
            "transport_mode": "AMBULANCE_108", "eta_minutes": 45, "raised_at": raised.isoformat(),
            "updated_at": raised.isoformat(), "payload": {"id": rid, "patientId": pid}}


with TestClient(district.app) as client:
    check("tables are created at startup", client.get("/health").status_code == 200)

    r = client.post("/api/v1/records/patients", json=patient("P-1", "सुनीता कोवे", NOW, age=1.5), headers=ANM)
    check("a patient record with a Devanagari name and a fractional age is stored", r.status_code == 202, r.text[:200])
    r = client.post("/api/v1/records/patients", json=patient("P-1", "WRONG", NOW - timedelta(hours=3)), headers=ANM)
    check("an older replay does not overwrite the newer record", r.status_code == 202 and r.json().get("duplicate") is True, r.text[:200])
    naive = {**patient("P-2", "Asha", NOW), "updated_at": "2026-10-01T09:00:00"}
    check("a timestamp without an offset is accepted as UTC", client.post("/api/v1/records/patients", json=naive, headers=ANM).status_code == 202)
    r = client.post("/api/v1/records/referrals", json=referral("R-1", "P-1", NOW), headers=ANM)
    check("a referral is stored", r.status_code == 202, r.text[:200])

    r = client.get("/api/v1/records/incoming?facility_id=dh-district", headers=MO)
    body = r.json() if r.status_code == 200 else {}
    check("the receiving facility's board lists the case", body.get("count") == 1, r.text[:300])
    case = (body.get("cases") or [{}])[0]
    check("…with the record exactly as uploaded (Unicode intact)",
          (case.get("patient") or {}).get("name") == "सुनीता कोवे" and (case.get("patient") or {}).get("visits") == [{"note": "प्रसूती"}],
          str(case.get("patient"))[:200])
    check("…and the referral's reason intact", (case.get("referral") or {}).get("patientId") == "P-1")

    r = client.get("/api/v1/store?limit=10", headers=DHO)
    dump = r.json() if r.status_code == 200 else {}
    check("the Data Inspector dump reads back both tables", dump.get("patient_records_total") == 2 and dump.get("care_referrals_total") == 1, r.text[:300])
    ages = {p["id"]: p["age"] for p in dump.get("patient_records", [])}
    check("the fractional age survives", ages.get("P-1") == 1.5, str(ages))

    r = client.get("/api/v1/access-log?limit=50", headers=DHO)
    log = r.json() if r.status_code == 200 else {}
    paths = [(e["path"], e["user_id"]) for e in log.get("entries", [])]
    check("the access log is written and read on PostgreSQL",
          ("/api/v1/records/incoming", "u-mo") in paths and ("/api/v1/records/patients", "u-anm") in paths, str(paths)[:300])

SQLModel.metadata.drop_all(district.engine)
print("")
if failures:
    print(f"{len(failures)} check(s) FAILED:")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("All checks passed — the district service works on PostgreSQL as it does on SQLite.\n")
