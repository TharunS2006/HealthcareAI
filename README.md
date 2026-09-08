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

The app works with no backend running — the "Mesh Relay" badge then shows
**STANDALONE**, and all data is stored locally in IndexedDB.

### Optional: mesh relay server on its own

```bash
npm run server        # starts server/mesh-server.ts on :3001
```

> `dev:full` backgrounds the relay with `&`; stopping `next dev` (Ctrl-C) may leave the
> relay running — `npm run server` shares its port, or `pkill -f mesh-server` to stop it.

### Other scripts

```bash
npm run build          # production static export (output: 'export', writes to out/)
npm run lint            # eslint
npm run verify:triage   # scripts/verify-triage.mts — sanity-checks the triage model's decisions
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

`/staff/*` and `/triage` are thin redirects to their canonical routes above.

## Notes for contributors

- The triage model (`lib/triage/model.ts`) is heavily commented on its own invariants (seeded determinism, clinical-override-outranks-network, timeout/fallback behavior) — read the file header before changing it.
- `lib/socket.ts` reports real connection state (`CONNECTING` / `ONLINE` / `STANDALONE`); never hardcode a "connected" badge in a new page — use `lib/hooks/useMeshStatus.ts`.
