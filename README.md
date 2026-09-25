# NalamMesh (नलममेश)

Offline-first digital public healthcare platform for rural Maharashtra — built for Smart India Hackathon 2025, Problem Statement #26133. Full project context, problem analysis, and module descriptions are in [`SIH_PROJECT_CONTEXT.md`](./SIH_PROJECT_CONTEXT.md).

## Stack

- **Next.js 14** (App Router, static export) + React 18 + TypeScript
- **TensorFlow.js** — in-browser edge AI triage, trained on-device from a seeded synthetic dataset (`lib/triage/model.ts`), backed by a deterministic IPHS clinical rule engine that always has the final say on danger signs
- **IndexedDB** (`idb`) — offline-first patient/queue/referral/inventory storage (`lib/db.ts`)
- **Zustand** — app state (`stores/`)
- **Socket.io** — optional real-time mesh relay between facilities (`server/mesh-server.ts`, `lib/socket.ts`); the app runs fully standalone without it
- **Capacitor** — Android build wrapper

## Getting started

```bash
npm install
npm run dev:full     # app on :3000 + mesh relay on :3001 → "Mesh Relay Online"
```

`dev:full` starts both the Next.js app and the Socket.io mesh relay so the
continuum-of-care sync (SC→PHC→CHC→DH) is live on a single machine without a second
terminal. The dashboard/sidebar "Mesh Relay" badge shows **ONLINE**.

For the app alone (no relay):

```bash
npm run dev          # http://localhost:3000
```

`npm run dev` always uses port 3000. If the app is already running it stops with
"address already in use" rather than starting a second copy on :3001 or :3002 —
two copies share the `.next` folder, overwrite each other's build and break with
"Cannot read properties of undefined (reading 'call')". Reload the tab you have,
or stop the old server (Ctrl-C in its terminal) before starting another.

The app works with no backend running — the "Mesh Relay" badge then shows
**STANDALONE**, and all data is stored locally in IndexedDB.

### Optional: mesh relay server on its own

```bash
npm run server        # starts server/mesh-server.ts on :3001
```

> `dev:full` backgrounds the relay with `&`; stopping `next dev` (Ctrl-C) may leave the
> relay running — `npm run server` shares its port, or `pkill -f mesh-server` to stop it.

### Optional: cloud assistant (Groq / Grok / Claude)

The in-app assistant has two layers with a scope gate between them.

**Layer 1 runs entirely offline** in the browser and answers from the app's own
data — triage thresholds, referral routing, facility services and equipment,
entitlements, clinic days, where a screen lives. It needs no key, no network,
and cannot hallucinate.

**The scope gate** (`lib/chat/scopeGuard.ts`) then decides whether the question
is one this assistant answers at all. It covers exactly two subjects: NalamMesh
itself, and rural public healthcare in India. Anything else — trivia, sport,
entertainment, creative writing, homework, financial or personal advice — is
declined on the device, with a reply naming what it does cover. The check runs
before any request is made, so a declined question is never a network call and
never reads as "the cloud is down", which is a different thing.

**Layer 2** is a cloud model, used only when Layer 1 finds no confident match,
the question is in scope, *and* the device is online. It is what answers open
questions — "what problem does this solve?", "how does a record reach the
hospital before the patient?" — because it is sent a brief describing the
platform alongside the clinical data.

The same boundary is written into the backend's system prompt, so a request
that reaches `/api/v1/chat` without passing through the app's own gate is
refused there too. `npm run verify:chat-scope` asserts the device-side rule
(including that everything Layer 1 answers offline also passes the gate, so no
question is stranded between the two); `npm run verify:chat-provider` asserts
the prompt still carries the rule.

Put one key in `backend/.env` (git-ignored, read at startup) and it turns on.
Nothing else changes:

```bash
cp backend/.env.example backend/.env
# then set ONE of these in it:
GROQ_API_KEY=gsk_...        # Groq   — api.groq.com
XAI_API_KEY=xai-...         # Grok   — xAI, api.x.ai
ANTHROPIC_API_KEY=sk-ant-.. # Claude — Anthropic
```

> **Groq and Grok are different services.** Groq (api.groq.com) serves
> open-weight models and issues `gsk_...` keys; Grok is xAI's own model at
> api.x.ai with `xai-...` keys. The names are one letter apart, so the backend
> checks the prefix and routes a key found in the wrong variable to the service
> that can actually accept it, rather than failing with "Incorrect API key".

With several set, Groq answers first; `CHAT_PROVIDER=grok|anthropic|groq` pins
one. With none set, `/api/v1/chat` returns 503 and the app falls back to its
offline answers — every clinical question still works.

Check which provider is live without sending a message:

```bash
curl -s localhost:8000/health
# → "chat_provider": "groq", "chat_model": "openai/gpt-oss-120b"
```

All options are documented in [`backend/.env.example`](./backend/.env.example).
Never commit a real key — `backend/.env` is git-ignored for this reason.

### Showing the data: the Data Inspector (`/data`)

`/data` puts the device database and the district cloud database side by side
on one screen, because "it works offline and syncs when there is signal" is a
claim worth checking rather than believing.

- **Left**: every IndexedDB object store on this device, with row counts and the
  rows themselves, expandable to raw JSON. Nine stores, read from
  `db.objectStoreNames`, so a store added later cannot quietly go missing from
  a screen whose whole job is completeness.
- **Right**: everything the district service is holding, from
  `GET /api/v1/store` — patient records and care referrals, newest arrival
  first, each showing the device's own payload beside the columns the service
  indexes on, so nothing was reshaped in transit.
- **Above both**: on this device / waiting to upload / in the district cloud /
  in both databases. The last tile is computed from ids actually present on
  both sides, not from two totals that happen to match.

A four-step walkthrough is printed at the bottom of the page: turn the network
off and register a patient, turn it back on, open the row on each side, then
stop the backend. That last step is the one worth doing in front of a judge —
the device column is unchanged and the app keeps working, and the cloud panel
says it could not reach the service rather than showing an empty store, since
"no records" and "no answer" are opposite claims about the same screen.

> **Before deploying anywhere public:** `/api/v1/store` returns identified
> patient records and, like every other endpoint on this service, is not
> authenticated. That is a known gap in this build, fine for a laptop demo and
> not for a host anyone else can reach.

### Evaluation and production builds

The same code builds two ways. **Evaluation** is the default: every device opens
with a fictional Gadchiroli district — patients, referrals, stock, bed reports and
one demo account per role on the public PIN **2468** — so every feature can be
tried at once, and a banner on every page says the data is fictional. A
**production** build seeds only the facility list and has no demo accounts.

| Setting | Where | Meaning |
|---|---|---|
| `NEXT_PUBLIC_DEPLOYMENT_MODE=production` | app build | no demonstration data, pages or accounts; Staff ID sign-in |
| `NALAMMESH_DEPLOYMENT_MODE=production` | relay | no demo accounts sign in; demonstration referrals refused; no reset |
| `NALAMMESH_BOOTSTRAP_ADMIN_PIN` | production relay | six digits: the first Super Admin (Staff ID `ADMIN-01`), created only while none exists — required |
| `NALAMMESH_BOOTSTRAP_ADMIN_NAME` | production relay | optional name for that account |
| `NALAMMESH_AUTH_SECRET` | relay | 32+ random characters; signs session tokens |
| `NEXT_PUBLIC_MESH_URL`, `NEXT_PUBLIC_REPORTING_URL`, `NEXT_PUBLIC_CHAT_URL` | app build | relay, district service and assistant; also what the Content Security Policy allows the app to connect to |

Setting up production: start the relay with the three `NALAMMESH_*` settings,
sign in on the relay's network with Staff ID `ADMIN-01` and the bootstrap PIN,
and create each staff member at `/admin` with their own PIN. They sign in the
first time with their Staff ID while connected; after that the device knows them
and they can sign in offline.

### Staff sign-in

Staff sign in with a role, a posting, their name (or, on a device that does not
know them yet, their Staff ID) and a **PIN**. The mesh relay checks the PIN (five
wrong tries lock the account for five minutes; unknown Staff IDs are locked the
same way) and returns a signed session token; the relay and the district service
accept only that token, and a referral event is only accepted from the user it
names. With no relay reachable, the PIN is checked on the device and work stays
there until the user re-enters their PIN while connected. A device holds the PIN
hashes of its own facility's staff only — never another facility's, a district
officer's or the Super Admin's.

### Hosting the relay (cross-device referrals on the live site)

```bash
bash scripts/build-relay-deploy.sh          # bundles server/relay/vercel.ts into ~/nalammesh-relay-deploy
cd ~/nalammesh-relay-deploy && npx vercel@latest deploy --prod
```

The project needs `NALAMMESH_AUTH_SECRET` and Upstash for Redis (Vercel Marketplace,
`upstash/upstash-kv`, created in `bom1` Mumbai; the relay function runs in `bom1`
too, so records are processed and stored in India). Missing either, every request
is a 503 naming what is missing — never a relay that keeps referrals in memory and
loses them. Rebuild the frontend with `NEXT_PUBLIC_MESH_URL=<relay URL>` and
`NEXT_PUBLIC_MESH_TRANSPORT=http`; devices then poll it every 10 seconds.

### Security

- Content Security Policy built from the three endpoint settings (scripts from
  the app only, no `eval`, connections only to the configured services), shipped
  in the page so it also covers a facility's own web server and the APK;
  `vercel.json` adds frame, MIME, referrer and permission headers (microphone
  only).
- Fonts and map assets are bundled — no third-party CDN is called from a
  citizen's browser.
- `npm audit --omit=dev` reports no vulnerabilities; CI fails on any high one.

### What the platform does not do

- It does not dispatch ambulances. 108 and 102 are called by phone; the app
  raises the emergency referral so the record reaches the receiving facility
  first, and the worker records the vehicle number when the control room gives it.
- It has no audio or video. The teleconsult screen is a structured record beside
  an eSanjeevani call (a worked example on evaluation builds only).
- It never suggests a medicine or a dose.
- ABDM (ABHA) and Bhashini work only with credentials issued to the deploying
  department; without them each says it is not configured.

### Government services

| Service | What it does here | Settings |
|---|---|---|
| ABDM sandbox (ABHA V3) | Citizen sign-in: an OTP to the ABHA-linked mobile, verified by ABDM | `ABDM_CLIENT_ID`, `ABDM_CLIENT_SECRET` |
| Bhashini | Voice input in OPD triage; translating referral notes between English, Hindi and Marathi | `BHASHINI_USER_ID`, `BHASHINI_ULCA_API_KEY`, `BHASHINI_PIPELINE_ID` |
| data.gov.in | Rural Health Statistics on the Command Center (committed in `lib/data/official/rhs.json`) | `DATA_GOV_IN_API_KEY` (only to refresh) |

All three run through the relay, so no key reaches a browser. Without their
settings, each says it is not configured rather than pretending.

### Android build

```bash
export NEXT_PUBLIC_MESH_URL=http://<LAN IP>:3001 NEXT_PUBLIC_REPORTING_URL=http://<LAN IP>:8000
npm run build && npm run android:network-config && npx cap sync android
cd android && ./gradlew assembleDebug        # needs a JDK (Android Studio's: Contents/jbr/Contents/Home)
```

The app runs from `http://localhost` inside the phone and may use plain HTTP only
to the relay and district hosts above.

### Checks

```bash
npm run lint        # ESLint over app, server and scripts, zero warnings
npm run typecheck   # TypeScript over app, server and verify scripts
npm run verify      # every verify:* suite below, with a summary
```

GitHub Actions runs all three, the production build and `npm audit` on every push
(`.github/workflows/ci.yml`).

### Other scripts

```bash
npm run build          # production static export (output: 'export', writes to out/)
npm run lint            # eslint
npm run verify:triage   # scripts/verify-triage.mts — sanity-checks the triage model's decisions
npm run verify:metrics  # facility scorecards and travel burden avoided, against hand-computed values
npm run verify:services # patient entitlements and service information
npm run verify:chat-thresholds # the assistant quotes the same danger-sign thresholds triage uses
npm run verify:equipment # pre-arrival readiness: what a receiving facility must have ready
npm run verify:permissions # role-based access: routes, actions and facility scope
npm run verify:referral-flow # the referral lifecycle, created to discharged, and who may do each step
npm run verify:capacity # bed, equipment and specialist checks; where a referral goes by default
npm run verify:chat-retrieval  # the offline assistant answers how workers actually ask
npm run verify:chat-safety     # ...and still refuses what it must refuse
npm run verify:chat-render     # model Markdown renders as elements, and can never become markup
npm run verify:chat-scope      # the assistant answers its two subjects and declines everything else
npm run verify:chat-provider   # cloud provider selection, attribution and failure reporting (no network)
npm run verify:records-api     # pre-arrival record sync: upload → receiving facility's board
npm run verify:store-api       # the Data Inspector's totals, ordering and payload round-trip
npm run verify:cloud-records   # the device → cloud wire, against a real FastAPI on a spare port
npm run verify:relay           # relay sign-in, tokens, authorship, sockets, hosted (Upstash-protocol) mode
npm run verify:access-api      # district service accepts only relay-signed tokens
npm run verify:abha            # ABHA V3 contract: headers, RSA-OAEP encryption, OTP flow, throttling
npm run verify:bhashini        # Bhashini config + compute contract, staff-only access
npm run verify:official-data   # RHS figures sum to the published totals; ratios as published
npm run verify:db-upgrade      # every on-device database version a phone may hold upgrades cleanly
npm run verify:place-names     # devices seeded by the generic build get the Gadchiroli names back
npm run verify:outbox          # the pre-arrival record waits for sign-in, is kept on refusal, never lost
npm run verify:icons           # every inline SVG icon path parses
npm run verify:csp             # the Content Security Policy and security headers
npm run verify:intake          # OPD intake: required vitals, no invented readings
npm run verify:queue-tokens    # OPD tokens run in order per facility per day
npm run verify:production-mode # a production device starts with no demonstration data
npm run verify:followup        # follow-up tasks come from patients' records; visits are saved
npm run fetch:rhs              # refresh the official data from data.gov.in
npm run cap:sync        # build + sync into the Android Capacitor project
npm run cap:open        # open the Android project in Android Studio
```

## App map

| Route | Module |
|---|---|
| `/opd` | OPD registration & edge AI triage (voice vitals, TensorFlow.js classification, OPD token) |
| `/dashboard` | District Health Command — facility census, KPIs, high-risk patient list |
| `/referrals` | Cross-facility referral Kanban + 108/102 ambulance tracking |
| `/queue` | Live OPD token queue, TV waiting-room display mode |
| `/teleconsult` | Low-bandwidth specialist teleconsultation |
| `/medicine` | Essential medicine stock + diagnostic lab order tracking |
| `/facilities` | 4-tier facility directory (Sub-Centre → PHC → CHC → DH) |
| `/followup` | High-risk ANC/SAM/NCD recall engine |
| `/staff` | Role-based staff command center (links into the above) |
| `/data` | Data Inspector — this device's IndexedDB beside the district cloud store |

`/staff/*` and `/triage` are thin redirects to their canonical routes above.

## Notes for contributors

- The triage model (`lib/triage/model.ts`) is heavily commented on its own invariants (seeded determinism, clinical-override-outranks-network, timeout/fallback behavior) — read the file header before changing it.
- `lib/socket.ts` reports real connection state (`CONNECTING` / `ONLINE` / `STANDALONE`); never hardcode a "connected" badge in a new page — use `lib/hooks/useMeshStatus.ts`.
