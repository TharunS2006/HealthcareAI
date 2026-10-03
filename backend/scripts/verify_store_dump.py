"""
Data Inspector store check — `python3 scripts/verify_store_dump.py`

/api/v1/store is what the Data Inspector screen renders, and that screen exists
to make one claim checkable in front of a judge: a record captured on a device
with no signal really does arrive here, whole. A screen that quietly shows the
wrong thing is worse than no screen, because it is believed. Four ways it could
mislead, each asserted here:

  1. The totals agree with the rows shown. The tiles above the panel read the
     totals while the panel lists rows; if `total` silently tracked `shown`,
     a store holding 900 records would report 25 and nobody would notice.
  2. Newest first means newest ARRIVAL. The demo action is "I just synced this"
     — it has to be the top row, even though the device that sent it may have a
     clock that is days out. An applied update counts as an arrival; a stale
     replay, which changes nothing, must not reorder anything.
  3. The payload round-trips byte-for-byte. The panel shows the device payload
     beside the projection columns precisely so that "nothing was reshaped in
     transit" is visible rather than promised — so it had better be true, in
     the JSON the browser receives and not merely in Python.
  4. The limit is bounded and honest. It caps rows without touching totals.

Runs against a throwaway SQLite file, so it never touches district.db.
"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/verify_store.db"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from session_tokens import TEST_SECRET, bearer  # noqa: E402

os.environ["NALAMMESH_AUTH_SECRET"] = TEST_SECRET

from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session, SQLModel  # noqa: E402

from app.main import (app, engine, store_dump, upload_care_referral,  # noqa: E402
                      upload_patient_record)
from app.schemas import CareReferralIn, PatientRecordIn  # noqa: E402

SQLModel.metadata.create_all(engine)

failures = []


def check(label, condition, detail=""):
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}\n        {detail}")
        failures.append(label)


NOW = datetime.now(timezone.utc)

# A payload with nesting, a non-ASCII name and a null, because those are the
# three things a careless re-serialisation mangles first.
def patient(pid, name, updated, **extra):
    payload = {
        "id": pid,
        "name": name,
        "age": 34,
        "gender": "F",
        "triageStatus": "RED",
        "vitals": {"spo2": 88, "bp": {"systolic": 90, "diastolic": 60}},
        "allergies": [],
        "lastVisitAt": None,
        **extra,
    }
    return PatientRecordIn(id=pid, facility_id="PHC-01", name=name, age=34,
                           gender="F", triage_priority="RED",
                           updated_at=updated, payload=payload)


def referral(rid, pid, updated, raised):
    payload = {"id": rid, "patientId": pid, "priority": "RED",
               "status": "INITIATED", "clinicalSummary": "गंभीर श्वास कष्ट"}
    return CareReferralIn(id=rid, patient_id=pid, from_facility_id="PHC-01",
                          to_facility_id="DH-01", status="INITIATED", priority="RED",
                          reason="Respiratory distress", clinical_summary="Severe hypoxia",
                          transport_mode="AMBULANCE_108", eta_minutes=20,
                          raised_at=raised, updated_at=updated, payload=payload)


with Session(engine) as s:
    # Uploaded oldest-to-newest, so arrival order and insertion order agree.
    for n in range(1, 6):
        upload_patient_record(patient(f"P-{n}", f"Patient {n}", NOW - timedelta(hours=n)), s)
    for n in range(1, 4):
        upload_care_referral(referral(f"R-{n}", f"P-{n}", NOW, NOW - timedelta(minutes=n)), s)

    # ── 1. Totals count the store, not the page ──────────────────────────────
    print("\nTotals describe the store; shown describes the page:")
    page = store_dump(limit=2, session=s)
    check("patient total counts every row in the table",
          page.patient_records_total == 5, f"total was {page.patient_records_total}")
    check("patient shown counts only the rows returned",
          page.patient_records_shown == 2 == len(page.patient_records),
          f"shown={page.patient_records_shown} rows={len(page.patient_records)}")
    check("referral total counts every row in the table",
          page.care_referrals_total == 3, f"total was {page.care_referrals_total}")
    check("referral shown counts only the rows returned",
          page.care_referrals_shown == 2 == len(page.care_referrals),
          f"shown={page.care_referrals_shown} rows={len(page.care_referrals)}")
    check("the limit is echoed back, so the page can say what it is showing",
          page.limit == 2, f"limit was {page.limit}")

    full = store_dump(limit=500, session=s)
    check("a limit above the row count returns everything, not a padded page",
          full.patient_records_shown == full.patient_records_total == 5,
          f"shown={full.patient_records_shown} total={full.patient_records_total}")

    # ── 2. Newest arrival first, by the server's clock ───────────────────────
    print("\nOrdering follows arrival here, not the device clock:")
    ids = [r.id for r in full.patient_records]
    check("the last record uploaded is the first row",
          ids[0] == "P-5", f"order was {ids}")
    check("rows descend by received_at",
          all(a.received_at >= b.received_at
              for a, b in zip(full.patient_records, full.patient_records[1:])),
          f"received_at order was {[r.received_at.isoformat() for r in full.patient_records]}")
    # P-1 carries the OLDEST device clock of the five. If ordering used
    # updated_at it would stay at the bottom after this update.
    check("a device clock days out does not decide the order",
          store_dump(limit=5, session=s).patient_records[-1].id == "P-1",
          "expected the earliest arrival last before the update")

    upload_patient_record(patient("P-1", "Patient 1 revised", NOW + timedelta(days=2)), s)
    after = store_dump(limit=5, session=s)
    check("an applied update floats its record to the top",
          after.patient_records[0].id == "P-1", f"order was {[r.id for r in after.patient_records]}")
    check("an update changes no totals — it is the same record",
          after.patient_records_total == 5, f"total was {after.patient_records_total}")
    check("the update is visible in the row, not just in the ordering",
          after.patient_records[0].name == "Patient 1 revised",
          f"name was {after.patient_records[0].name!r}")

    top_before = store_dump(limit=5, session=s).patient_records[0].received_at
    upload_patient_record(patient("P-3", "STALE REPLAY", NOW - timedelta(days=9)), s)
    replayed = store_dump(limit=5, session=s)
    check("a stale replay does not reorder the store",
          replayed.patient_records[0].id == "P-1",
          f"order was {[r.id for r in replayed.patient_records]}")
    check("a stale replay leaves the top row's arrival time alone",
          replayed.patient_records[0].received_at == top_before,
          f"{replayed.patient_records[0].received_at} != {top_before}")
    check("a stale replay never overwrites the stored name",
          next(r.name for r in replayed.patient_records if r.id == "P-3") == "Patient 3",
          "the rejected replay reached the columns")

    # ── 3. The payload is the record — over HTTP, not just in Python ─────────
    print("\nThe device payload survives the trip, in the JSON the browser reads:")
    # The full store is District Health Officer / Super Admin only (data:inspect).
    client = TestClient(app, headers=bearer("u-dho", "DHO"))
    body = client.get("/api/v1/store", params={"limit": 50}).json()

    check("the response carries both tables as arrays",
          isinstance(body.get("patient_records"), list)
          and isinstance(body.get("care_referrals"), list),
          f"keys were {sorted(body)}")

    sent = patient("P-5", "Patient 5", NOW - timedelta(hours=5)).payload
    got = next(r["payload"] for r in body["patient_records"] if r["id"] == "P-5")
    check("patient payload is identical, nesting and nulls included",
          got == sent, f"sent {sent}\n        got  {got}")
    check("a null in the payload stays null and is not dropped",
          "lastVisitAt" in got and got["lastVisitAt"] is None, f"got {got.get('lastVisitAt', '<missing>')!r}")
    check("an empty list in the payload stays an empty list",
          got.get("allergies") == [], f"got {got.get('allergies')!r}")

    devanagari = next(r["payload"] for r in body["care_referrals"] if r["id"] == "R-1")
    check("Devanagari in a clinical summary comes back unmangled",
          devanagari["clinicalSummary"] == "गंभीर श्वास कष्ट",
          f"got {devanagari['clinicalSummary']!r}")

    # The panel puts columns beside payload so a judge can see they agree.
    row = next(r for r in body["patient_records"] if r["id"] == "P-5")
    check("projection columns agree with the payload they came from",
          row["name"] == row["payload"]["name"] and row["age"] == row["payload"]["age"],
          f"column {row['name']!r}/{row['age']} vs payload "
          f"{row['payload']['name']!r}/{row['payload']['age']}")

    # ── 4. The limit is bounded ──────────────────────────────────────────────
    print("\nThe limit is bounded, so no caller can ask for the whole store at once:")
    check("limit=0 is rejected rather than silently treated as 'all'",
          client.get("/api/v1/store", params={"limit": 0}).status_code == 422,
          f"status {client.get('/api/v1/store', params={'limit': 0}).status_code}")
    check("limit above the ceiling is rejected",
          client.get("/api/v1/store", params={"limit": 501}).status_code == 422,
          f"status {client.get('/api/v1/store', params={'limit': 501}).status_code}")
    check("the ceiling itself is accepted",
          client.get("/api/v1/store", params={"limit": 500}).status_code == 200)
    check("no limit at all is a working default, not an error",
          client.get("/api/v1/store").status_code == 200)

print("")
if failures:
    print(f"{len(failures)} check(s) failed: {', '.join(failures)}\n")
    sys.exit(1)
print("All checks passed — the Data Inspector reads honest totals, newest-arrival")
print("ordering that a wrong device clock cannot disturb, and payloads that reach")
print("the browser exactly as the device wrote them.\n")
