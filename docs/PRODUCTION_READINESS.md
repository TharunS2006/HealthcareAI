# NalamMesh — production readiness and government handover

*Status as of 10 October 2026. Read this before NalamMesh is used for any real patient.*

## 1. Where it stands

**The software side is ready for a supervised pilot. It is not yet cleared for
use with real patients.** The code now enforces what a government deployment
needs from software: authenticated and audited access to records, a production
mode with no demonstration data, durable server state, offline operation
verified in a browser, and accessibility and dependency checks in CI. What
remains are approvals and operational arrangements that no code change can
supply: a licence from the team, clinical validation of the triage engine, the
regulator's view of it, an empanelled security audit, government hosting, and
ABDM certification. Section 3 lists each one, with who owns it.

## 2. What the software enforces now

Every row is checked automatically on every push (`.github/workflows/ci.yml`)
unless marked otherwise.

| Area | What holds | Checked by |
|---|---|---|
| Sign-in | PIN checked by the relay; five wrong tries lock the account for five minutes (unknown Staff IDs too); signed 12-hour session tokens; a device holds PIN hashes of its own facility's staff only | `verify:relay`, `verify:permissions` |
| Roles and scope | Six roles; every screen, action and server route checks the role and the posting — a PHC reads its own pre-arrival board, not the District Hospital's | `verify:permissions`, `verify:access-api`, `verify:referral-flow` |
| Production mode | No demo patients, accounts or pages; the first Super Admin from a bootstrap PIN, ignored once one exists; demonstration referrals refused | `verify:production-mode`, `verify:relay` |
| Server state survives restarts | A production relay keeps staff accounts and referrals in transit in an atomically written, owner-only file, and refuses to start with them in memory | `verify:relay` (a real restart) |
| District record service | A relay-signed token on every record route; every request access-logged (refused ones too) and readable by the DHO on the Audit screen; revoked accounts refused at once; 2 MB body limit; record responses never cached; API docs can be turned off | `verify:backend-hardening`, `verify:cloud-records`, `verify:access-api` |
| PostgreSQL | The district service runs against a real PostgreSQL 16 | `verify:postgres` (CI service) |
| Offline | An installed app opens every ANM screen with the server stopped; uploads wait in a durable outbox, oldest first, and are never dropped; every database version a phone may hold upgrades cleanly | `check:offline` (browser), `verify:service-worker`, `verify:outbox`, `verify:db-upgrade` |
| On the device | Idle screens lock behind the PIN (15 minutes); on Android no screenshots or recent-apps thumbnail, and app data is excluded from cloud backup and device transfer | `verify:session-lock`; Android flags by inspection |
| No invented figures | Every number on a screen comes from a record or says "not recorded" — vitals, stock, queue waits, follow-ups, scorecards | `verify:intake`, `verify:stock`, `verify:queue-tokens`, `verify:followup`, `verify:metrics` |
| Triage safety | Danger-sign rules can only raise urgency, never lower it; with the model unavailable the rules alone decide, and give every test case the same acuity; the result slip says it is decision support and the health worker or MO decides | `verify:triage` (20 cases, all three decision paths) |
| Assistant | Phone, Aadhaar and ABHA numbers removed before a question leaves the device, and again on the server; rate limits; answers only NalamMesh and rural public health; a self-hosted model keeps questions in-house | `verify:chat-redaction`, `verify:chat-guard`, `verify:chat-scope`, `verify:chat-safety` |
| Accessibility floor | No axe-core WCAG 2.1 A/AA violation on 28 pages, signed in per role | `check:a11y` (browser) |
| Dependencies | No known vulnerability in production npm dependencies or the Python services | `npm audit`, `pip-audit` |
| Wristbands | QR codes decode to the patient's id | `verify:qr` |

## 3. Before any real patient — what only the department or the team can do

Numbered in the order they block. None of these can be closed by changing code.

1. **Licence (the team).** [`LICENSE`](../LICENSE) reserves all rights: the
   department cannot lawfully deploy, host or modify the software today. The
   team must grant a written licence to the department, or release it under an
   open-source licence (the Government of India's policy on adopting open-source
   software prefers this for e-governance).
2. **Clinical validation of triage (department, with clinicians).** The
   on-device model is trained on a *synthetic* dataset, and the danger-sign
   thresholds come from IPHS and protocol documents but have not been reviewed
   by a clinical committee. The 20 test cases guard against regressions; they
   are not validation. Needed: a clinical review of every rule and threshold,
   then a study comparing the tool's triage with clinicians' on real
   presentations (with ethics committee approval), with sensitivity for RED
   cases as the primary measure. Until then, triage is a prompt a clinician
   confirms, and the slip says so.
3. **Regulatory status (department).** Software that ranks a patient's urgency
   may be a medical device under the Medical Devices Rules, 2017. Ask CDSCO
   for its classification of the triage engine, and for a licence if it is
   required, before triage output is used clinically. Record-keeping, referral
   and stock functions are not the question; triage is.
4. **Security audit (department).** An audit by a CERT-In-empanelled auditor —
   application and API testing of the app, relay, district service and Android
   build, and of the hosting — with findings fixed and re-tested before go-live.
5. **Hosting and data residency (department).** A State Data Centre or a
   MeitY-empanelled cloud, with TLS everywhere; PostgreSQL on encrypted storage
   with tested backups; the relay's store file on an encrypted, backed-up
   volume. The public demo sites (Vercel, Upstash) are for evaluation only.
6. **Data protection (department).** Under the Digital Personal Data Protection
   Act, 2023 and its Rules: decide the legal basis for processing patients'
   data (consent, or a legitimate use such as a State service or a medical
   emergency); give notice in the patient's language at registration; set a
   retention schedule; handle access, correction and erasure requests; name the
   officer responsible; and report incidents (CERT-In expects cyber incidents
   within 6 hours). The app shows citizens a privacy notice and keeps an access
   log, but **does not yet record per-patient notice or consent** — the
   department must say which it needs before that is built.
7. **ABDM (department).** ABHA verification works against the ABDM *sandbox*
   only, and FHIR R4 bundles are generated for download but not exchanged.
   Production needs ABDM integration certification (milestones M1–M3), the
   department's production credentials, and its facilities and professionals
   on the HFR and HPR registries.
8. **Accessibility certification (department).** Automated checks find roughly
   a third of WCAG failures. A manual audit with screen readers (NVDA,
   TalkBack) and keyboard-only use is still due, and STQC/GIGW certification
   for the public portal.
9. **Language (department).** Citizen-facing pages, OPD registration, the
   command centre, the queue, medicine, diagnostics and appointment screens and
   the navigation are in English, Hindi and Marathi. The referral and
   pre-arrival boards, the ANM dashboard, the patient record, teleconsult,
   facility resources, administration, audit and data screens are English
   only. Translate them through the department's language cell or Bhashini,
   with clinical terms reviewed by a clinician. Unreviewed machine translation
   of clinical instructions is not acceptable.
10. **Devices (department).** Facility-owned Android devices under mobile device
    management: encryption, a screen lock, remote wipe, and controlled app
    updates. The app locks idle screens and blocks screenshots, but it cannot
    wipe a lost phone. On shared PCs, one OS account per person.
11. **The assistant (department).** Either a model the department hosts
    (`CHAT_BASE_URL`) or the offline answers only. If an external provider is
    used: a data-protection impact assessment, a spending cap on the account,
    and `CHAT_REQUIRE_SIGN_IN=true` if citizens are not meant to reach it.
12. **Operations (department).** Monitoring of both services' `/health`;
    backup-and-restore drills for PostgreSQL and the relay store; an incident
    runbook; a helpdesk; training for ANMs, MOs and DHOs; and a paper fallback
    for downtime. Add a schema migration tool (Alembic) before the first
    upgrade of a live database.
13. **A supervised pilot.** One chain (a Sub-Centre, its PHC, CHC and the
    District Hospital) for a fixed period, with outcomes measured, before any
    wider rollout.

## 4. Known limitations of the software

- **No restore to a replacement device.** Every patient record a device
  registers or updates is uploaded to the district service, but a new phone
  cannot yet download its facility's records back. Records still waiting in a
  lost phone's outbox are lost with it.
- **District aggregates are computed on the DHO's device**, from what the relay
  delivers. The district service's de-identified reporting endpoints exist, but
  the app does not send to them yet.
- **No audio or video teleconsultation** — by design, the teleconsult screen is a
  structured record beside an eSanjeevani call.
- **No ambulance dispatch** — 108 and 102 are called by phone; the app records
  the vehicle and the transit time.
- **Data on the device** is protected by the phone's own encryption and the
  app's lock, not by encryption of its own.
- **Lockout counts** reset when the relay restarts (accounts and referrals do
  not).
- **Session tokens** are valid for 12 hours. With `NALAMMESH_RELAY_URL` set,
  the district service refuses a revoked account within a minute; without it,
  only when the token expires.

## 5. Configuring a production deployment

On the department's servers, in this order. Every setting is documented in the
repository-root [`.env.example`](../.env.example) and
[`backend/.env.example`](../backend/.env.example).

1. **Secrets.** Generate one signing secret, 32+ random characters
   (`openssl rand -base64 36`). The relay and the district service both get it
   as `NALAMMESH_AUTH_SECRET`.
2. **District record service** (`backend/`): `pip install -r
   requirements-postgres.txt`; set `DATABASE_URL` (PostgreSQL),
   `NALAMMESH_AUTH_SECRET`, `NALAMMESH_RELAY_URL`, `CORS_ORIGINS` (the app's own
   origin), `API_DOCS=off`, and the assistant settings if any; run `uvicorn
   app.main:app` behind a TLS reverse proxy.
3. **Mesh relay**: set `NALAMMESH_DEPLOYMENT_MODE=production`,
   `NALAMMESH_BOOTSTRAP_ADMIN_PIN` (six digits), `NALAMMESH_AUTH_SECRET` and
   `NALAMMESH_RELAY_STORE_FILE`; run `npm run server` as a service behind TLS
   (it uses websockets). It refuses to start if any of these is missing.
4. **The app**: `NEXT_PUBLIC_DEPLOYMENT_MODE=production`, with
   `NEXT_PUBLIC_MESH_URL`, `NEXT_PUBLIC_REPORTING_URL` and
   `NEXT_PUBLIC_CHAT_URL` set to the HTTPS addresses above; then `npm ci && npm
   run build`, and serve `out/` over HTTPS (the service worker needs it) with
   the headers in `vercel.json`.
5. **Android**: build with the same settings (`npm run cap:sync`), sign the APK
   with the department's key, and distribute it through device management.
6. **First accounts**: sign in with Staff ID `ADMIN-01` and the bootstrap PIN;
   at `/admin` create named administrators, then each staff member with their
   own PIN. The bootstrap PIN is ignored once a Super Admin exists.
7. **Check it end to end**: both `/health` endpoints report production (the
   relay names its store file); an ANM signs in on a device and registers and
   refers a test patient; the receiving MO sees the patient on the Pre-Arrival
   Board; the DHO sees both requests in the access log on the Audit screen.
   Remove the test patient afterwards.
8. **On each release**, CI must be green on the release commit: lint,
   typecheck, `npm run verify`, the build, `check:a11y`, `check:offline`, and
   both dependency audits.
