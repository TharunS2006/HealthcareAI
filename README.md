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

### Other scripts

```bash
npm run build          # production static export (output: 'export', writes to out/)
npm run lint            # eslint
npm run verify:triage   # scripts/verify-triage.mts — sanity-checks the triage model's decisions
npm run verify:chat-retrieval  # the offline assistant answers how workers actually ask
npm run verify:chat-safety     # ...and still refuses what it must refuse
npm run verify:chat-render     # model Markdown renders as elements, and can never become markup
npm run verify:chat-scope      # the assistant answers its two subjects and declines everything else
npm run verify:chat-provider   # cloud provider selection, attribution and failure reporting (no network)
npm run verify:records-api     # pre-arrival record sync: upload → receiving facility's board
npm run verify:store-api       # the Data Inspector's totals, ordering and payload round-trip
npm run verify:cloud-records   # the device → cloud wire, against a real FastAPI on a spare port
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
