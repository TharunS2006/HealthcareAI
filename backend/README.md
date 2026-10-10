# NalamMesh — District Record Service

FastAPI service with three jobs the device-first app cannot do on its own:

1. **Pre-arrival hand-off.** Every patient registered or updated on a device,
   and every referral, is queued on that device and uploaded here when it has a
   connection (`lib/sync/outbox.ts`). A receiving facility reads its
   **Pre-Arrival Board** (`/incoming`) from here, so the record reaches the
   hospital before the ambulance does. These are **identified records** — name,
   age, vitals, history — and are treated as such below.
2. **District oversight.** The Data Inspector (`/data`) and the access log on
   the Audit screen (`/audit`) read from here.
3. **Layer 2 of the in-app assistant** (`/api/v1/chat`), when a model is
   configured.

## This is not the clinical source of truth

Each device's own IndexedDB is. If this service is down, care continues: the
device keeps working, uploads wait in the outbox (retried forever, oldest
first), and every screen that reads the service says it could not be reached
rather than showing an empty list.

## Run

    pip install -r requirements.txt            # SQLite, for one machine
    pip install -r requirements-postgres.txt   # PostgreSQL, for a deployment
    uvicorn app.main:app --port 8000

Interactive API docs: http://localhost:8000/docs (turn off with `API_DOCS=off`).

## Who may call what

Every `/api/v1` route except the assistant needs the **session token the mesh
relay signs** when a staff member enters their PIN (`app/access.py`, with the
same `NALAMMESH_AUTH_SECRET` as the relay). The role and posting come from the
token, never from the request. Permissions are generated from the app's own
role table (`lib/auth/permissions.ts` → `app/permissions.json`, `npm run
export:permissions`), so the two cannot drift.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health` | anyone | Liveness, table counts, which assistant provider is live (never a key) |
| POST | `/api/v1/records/patients` | any signed-in staff | Upload a patient record (identified). An older copy never overwrites a newer one |
| POST | `/api/v1/records/referrals` | any signed-in staff | Upload a referral with its clinical payload |
| GET | `/api/v1/records/incoming?facility_id=` | MO, Hospital Admin — own facility; DHO, Super Admin — any | Patients en route to a facility, most urgent first |
| GET | `/api/v1/store` | DHO, Super Admin | Everything the record store holds, newest first (Data Inspector) |
| GET | `/api/v1/access-log` | DHO, Super Admin | Who read or uploaded identified records, refused attempts included |
| POST | `/api/v1/chat` | anyone, rate-limited (or signed-in staff only, with `CHAT_REQUIRE_SIGN_IN`) | Assistant Layer 2 |
| POST | `/api/v1/facilities`, `/api/v1/encounters`, `/api/v1/referrals` | any signed-in staff | De-identified reporting (no name, ABHA id, vitals or complaint) |
| GET | `/api/v1/district/summary`, `/api/v1/facilities/{id}/scorecard` | DHO, Super Admin | Aggregates over the de-identified tables |
| GET | `/api/v1/facilities` | any signed-in staff | Reporting facilities |

The de-identified reporting tables are ready, but **the app does not send to
them yet**: today the district view in the app is computed on the DHO's device
from what the relay delivers. Wire a sender before relying on these aggregates.

## Safeguards

- **Access log.** Every `/api/v1` request except the assistant is recorded:
  time, user, role and posting from the token (refused requests too, anonymous
  ones as anonymous), method, path, query, status, the caller's address, and
  which records it carried or returned (`patient P-1`, `3 incoming case(s): …`).
  The DHO reads it on the Audit screen.
- **Revocation.** With `NALAMMESH_RELAY_URL` set, a token whose user has since
  been deactivated, moved or re-roled is refused here at once, not when it
  expires (12 hours). Answers are cached for a minute. An unreachable relay
  admits a valid token unless `NALAMMESH_RELAY_CHECK=strict`.
- **Limits and headers.** Request bodies over `MAX_REQUEST_BYTES` (2 MB) are
  refused with 413, counted as they arrive so a chunked upload cannot slip
  past. Responses are `nosniff`, unframeable and referrer-free; `/api/v1`
  responses are `no-store`, so no browser or proxy keeps a copy.
- **Assistant.** Phone, Aadhaar and ABHA numbers and email addresses are
  removed from a question before it is sent (on the device and again here);
  callers are rate-limited per minute and per day, with a daily ceiling for
  the whole process; a signed-in caller's role comes from their token. A
  self-hosted model (`CHAT_BASE_URL`) keeps questions inside the department's
  own infrastructure; `/health` says `chat_hosting: self-hosted | external`.

## Configuration

All environment variables; every one is documented in
[`.env.example`](./.env.example). The ones a deployment must decide:

| Variable | Default | Production |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./district.db` | `postgresql+psycopg://…` (install `requirements-postgres.txt`). Tables are created at startup |
| `NALAMMESH_AUTH_SECRET` | dev file | The relay's value, 32+ random characters |
| `NALAMMESH_RELAY_URL` | unset | The relay's address, so revoked accounts are refused at once |
| `CORS_ORIGINS` | `*` | The app's own origin(s) only |
| `API_DOCS` | on | `off` |
| `CHAT_BASE_URL` / `CHAT_MODEL` | unset | A model the department hosts, or leave the assistant offline-only |
| `CHAT_REQUIRE_SIGN_IN` | false | `true` unless citizens are meant to reach the cloud assistant |

## Deployment

The service holds identified health records. Run it on the facility or
district network or a State Data Centre / MeitY-empanelled cloud, behind TLS,
on PostgreSQL with backups — never on a public free tier. A `Procfile` is
included for hosts that use one:

    web: uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

Point the app at it with `NEXT_PUBLIC_REPORTING_URL` (repository-root
`.env.example`). The tables are created with `create_all`; add a migration tool
(Alembic) before the first schema change on a live database.

The assistant alone can be deployed without the record store —
`scripts/build_assistant_deploy.sh` stages it with the same guards
(`api/index.py`).

## Checks

    npm run verify:records-api         # upload → pre-arrival board, stale replays
    npm run verify:store-api           # Data Inspector totals, ordering, payloads
    npm run verify:access-api          # only relay-signed tokens; facility scope
    npm run verify:backend-hardening   # access log, body limit, headers, docs, revocation
    npm run verify:chat-guard          # redaction, rate limits, sign-in policy
    npm run verify:chat-provider       # provider selection, hosting, failure reporting
    npm run verify:postgres            # the same against a real PostgreSQL (TEST_POSTGRES_URL)
