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
| POST | `/api/v1/chat` | Layer 2 of the in-app assistant — relays a question plus the client's grounding brief to Claude |

`/api/v1/chat` is the one endpoint here that is not reporting. It holds no copy of
the clinical data: the client renders a grounding brief from its own facility,
threshold and entitlement modules (`lib/chat/groundingBrief.ts`) and sends it with
each question, so there is no second place for those facts to drift. With
`ANTHROPIC_API_KEY` unset it returns 503 and the app falls back to its offline
protocol answers — the assistant works with this service switched off.

## Conventions carried over from the clinical app

- **Nothing is invented.** Where no referral recorded a real dispatch time,
  `median_transit_minutes` is `null`, not `0`. Where no facility reported bed
  capacity, `bed_occupancy_pct` is `null`.
- **Ingest is idempotent.** A device replaying its offline queue cannot
  double-count encounters.

## Cloud deployment

The service is deployable as-is to any host that runs a `Procfile` (Render,
Railway, Fly, Heroku). Nothing about the deploy is required for the app to work —
it stays a courier, never a dependency.

    web: uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

Configuration is entirely environment variables; see `.env.example`. All are
optional, and unset means the local-demo behaviour:

| Variable | Default | Effect |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./district.db` | Point at managed Postgres for a real deploy. SQLModel needs no code change; uncomment `psycopg` in `requirements.txt`. |
| `ANTHROPIC_API_KEY` | unset | Enables `/api/v1/chat`. Unset, that endpoint returns 503 and the app answers offline. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Model override. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins. Narrow this on a public host. |

Most hosts give an ephemeral filesystem, so SQLite there loses its data on every
restart — set `DATABASE_URL` before treating a deployed instance as durable.

Point the frontend at the deployed service with `NEXT_PUBLIC_REPORTING_URL`
(see the repository-root `.env.example`).
