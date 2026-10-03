"""
Pre-arrival record sync check — `python3 scripts/verify_records.py`

The hand-off these endpoints carry is: a device uploads a patient and a
referral when it gets signal, and the receiving facility reads the pair off
/records/incoming in time to ready equipment. That chain has four ways to fail
quietly, so each is asserted here rather than eyeballed:

  1. A stale replay from a device that was offline overwrites a newer record.
     Silent, and it would put outdated vitals in front of the receiving team.
  2. The referral arrives but its patient record has not. The board must still
     show that someone is coming, with patient=None, not drop the row.
  3. The board shows cases that are no longer coming (completed/cancelled), or
     is ordered by anything other than urgency-then-wait.
  4. The stored payload comes back altered. It is the clinical record; it has
     to round-trip byte-for-byte.

Runs against a throwaway SQLite file, so it never touches district.db.
"""
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/verify_records.db"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, SQLModel  # noqa: E402

from app.main import (engine, incoming_cases, upload_care_referral,  # noqa: E402
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


def patient(pid, name, updated, priority="RED", **extra):
    payload = {"id": pid, "name": name, "age": 34, "gender": "F",
               "triageStatus": priority, "vitals": {"spo2": 88}, **extra}
    return PatientRecordIn(id=pid, facility_id="PHC-01", name=name, age=34,
                           gender="F", triage_priority=priority,
                           updated_at=updated, payload=payload)


def referral(rid, pid, updated, raised, priority="RED", status="INITIATED", eta=20):
    payload = {"id": rid, "patientId": pid, "priority": priority,
               "status": status, "clinicalSummary": "Severe hypoxia"}
    return CareReferralIn(id=rid, patient_id=pid, from_facility_id="PHC-01",
                          to_facility_id="DH-01", status=status, priority=priority,
                          reason="Respiratory distress", clinical_summary="Severe hypoxia",
                          transport_mode="AMBULANCE_108", eta_minutes=eta,
                          raised_at=raised, updated_at=updated, payload=payload)


with Session(engine) as s:
    # ── 1. Upload, then replay an older copy ─────────────────────────────────
    print("\nStale replays never overwrite a newer record:")
    upload_patient_record(patient("P-1", "Lakshmi Devi", NOW), s)
    stale = upload_patient_record(patient("P-1", "WRONG NAME", NOW - timedelta(hours=6)), s)
    check("an older upload is acknowledged, not applied",
          stale.duplicate is True, f"receipt was {stale!r}")

    fresh = upload_patient_record(patient("P-1", "Lakshmi Devi Rao", NOW + timedelta(minutes=5)), s)
    check("a newer upload updates in place", fresh.updated is True, f"receipt was {fresh!r}")

    # ── 2. Referral with no record yet ───────────────────────────────────────
    print("\nA half-arrived pair still shows on the board:")
    upload_care_referral(referral("R-orphan", "P-missing", NOW, NOW - timedelta(minutes=2)), s)
    board = incoming_cases("DH-01", s)
    orphan = [c for c in board.cases if c.referral["id"] == "R-orphan"]
    check("referral without its record is still listed", len(orphan) == 1,
          f"board held {[c.referral['id'] for c in board.cases]}")
    check("its patient is None rather than a fabricated record",
          bool(orphan) and orphan[0].patient is None,
          f"patient was {orphan[0].patient if orphan else 'n/a'}")

    # ── 3. Only what is still coming, urgent first ───────────────────────────
    print("\nBoard shows only en-route cases, most urgent first:")
    upload_care_referral(referral("R-green", "P-1", NOW, NOW - timedelta(hours=2),
                                  priority="GREEN", status="IN_TRANSIT"), s)
    upload_care_referral(referral("R-red-new", "P-1", NOW, NOW - timedelta(minutes=1)), s)
    upload_care_referral(referral("R-red-old", "P-1", NOW, NOW - timedelta(hours=1)), s)
    upload_care_referral(referral("R-done", "P-1", NOW, NOW - timedelta(minutes=30),
                                  status="COMPLETED"), s)
    upload_care_referral(referral("R-cancelled", "P-1", NOW, NOW - timedelta(minutes=30),
                                  status="CANCELLED"), s)

    board = incoming_cases("DH-01", s)
    ids = [c.referral["id"] for c in board.cases]
    check("completed case is off the board", "R-done" not in ids, f"board: {ids}")
    check("cancelled case is off the board", "R-cancelled" not in ids, f"board: {ids}")
    check("count matches the rows returned", board.count == len(board.cases),
          f"count={board.count} rows={len(board.cases)}")

    reds = [i for i in ids if i.startswith("R-red") or i == "R-orphan"]
    check("every RED sorts above the GREEN",
          all(ids.index(r) < ids.index("R-green") for r in reds),
          f"order was {ids}")
    check("among REDs the longest-waiting comes first",
          ids.index("R-red-old") < ids.index("R-red-new"),
          f"order was {ids}")

    # ── 4. The payload is the record — it must round-trip intact ─────────────
    print("\nThe clinical payload round-trips unaltered:")
    carried = next(c for c in board.cases if c.referral["id"] == "R-red-new")
    check("referral payload survives the trip",
          carried.referral["clinicalSummary"] == "Severe hypoxia",
          f"got {carried.referral!r}")
    check("patient payload survives the trip, newest name included",
          carried.patient is not None
          and carried.patient["name"] == "Lakshmi Devi Rao"
          and carried.patient["vitals"] == {"spo2": 88},
          f"got {carried.patient!r}")

    # ── 5. An infant's age is not a whole number ─────────────────────────────
    # A referral for a 1.5-year-old was refused with HTTP 422 because `age` was
    # declared int. Paediatric emergencies are exactly the cases this service
    # must not drop, so the fractional year is asserted here rather than left to
    # be rediscovered on a dispatch.
    print("\nUnder-5 records with fractional ages are accepted:")
    infant = PatientRecordIn(id="P-baby", facility_id="PHC-01",
                             name="Baby Aarav", age=1.5, gender="M",
                             triage_priority="RED", updated_at=NOW,
                             payload={"id": "P-baby", "name": "Baby Aarav",
                                      "age": 1.5, "gender": "M",
                                      "triageStatus": "RED",
                                      "vitals": {"spo2": 91}})
    receipt = upload_patient_record(infant, s)
    check("a 1.5-year-old's record is stored, not refused",
          receipt.accepted is True and receipt.duplicate is False, f"receipt was {receipt!r}")

    upload_care_referral(referral("R-baby", "P-baby", NOW, NOW - timedelta(minutes=4)), s)
    baby_board = incoming_cases("DH-01", s)
    baby = next((c for c in baby_board.cases if c.referral["id"] == "R-baby"), None)
    check("the infant reaches the board with the record attached",
          baby is not None and baby.patient is not None
          and baby.patient["age"] == 1.5,
          f"got {baby!r}")

    # ── 6. Another facility's board is not this one's ────────────────────────
    print("\nFacilities see only their own incoming cases:")
    other = incoming_cases("CHC-09", s)
    check("a facility with nothing en route gets an empty board",
          other.count == 0 and other.cases == [], f"got {other!r}")

print("")
if failures:
    print(f"{len(failures)} check(s) FAILED:")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("All checks passed — uploads are replay-safe, the board shows only what is")
print("still coming in urgency order, and clinical payloads arrive unaltered.\n")
