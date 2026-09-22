# NalamMesh — District Reporting Service

FastAPI service providing the one thing the device-first clinical platform
deliberately cannot: a district-wide view.

Facility records live in each device's own IndexedDB and are exchanged peer to
peer by the mesh relay. That keeps care working when a sub-centre is cut off,
and keeps patient data on the device that captured it — but it means no single
place can answer "how many RED cases across all facilities this week?".

Facilities push a **reduced, de-identified** summary here; the District Health
Office queries aggregates.

## This is not the clinical source of truth

The mobile and web app never read from this service. If it is down, care
continues unaffected. Nothing here sits between a health worker and a patient
record.

De-identification is structural, not a policy note: the `encounters` table has
no name, no ABHA id, no vitals and no free-text complaint. The district learns
that a RED maternal case was seen at a PHC on a date — not who it was.

## Run

    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

Interactive API docs: http://localhost:8000/docs

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET  | `/health` | Liveness and store depth |
| POST | `/api/v1/facilities` | Register or update a reporting facility |
| POST | `/api/v1/encounters` | Report a de-identified encounter (idempotent) |
| POST | `/api/v1/referrals` | Report a tier-to-tier referral (upsert) |
| GET  | `/api/v1/district/summary?days=7` | District totals for a rolling window |
| GET  | `/api/v1/facilities` | All reporting facilities, optionally by tier |
| GET  | `/api/v1/facilities/{id}/scorecard?days=30` | Per-facility scorecard |

## Conventions carried over from the clinical app

- **Nothing is invented.** Where no referral recorded a real dispatch time,
  `median_transit_minutes` is `null`, not `0`. Where no facility reported bed
  capacity, `bed_occupancy_pct` is `null`.
- **Ingest is idempotent.** A device replaying its offline queue cannot
  double-count encounters.
