# NalamMesh — Close-the-Gaps Prompt (PS #26133 Compliance Pass)

> **What this is:** A ready-to-paste prompt for an AI coding agent (Claude Code, Cursor, etc.)
> working **inside this repo**. It lists every feature the problem statement (SIH PS #26133)
> asks for that is currently **missing, partial, or simulated** — verified against the actual
> source, not the README. Feed one section at a time; each has current state, target state,
> concrete files, and an acceptance checklist.
>
> Stack context the agent should assume (already in the repo — do not re-architect):
> Next.js 14 App Router · React 18 · TypeScript · Zustand (`stores/`) · IndexedDB via `idb`
> (`lib/db.ts`) · TensorFlow.js triage (`lib/triage/model.ts`) · `lib/i18n.ts` (en/hi/mr) ·
> static export build (`next.config.js`, `output: 'export'`).

---

## How to use this

Copy **one numbered section** into the agent per task. Do not batch all ten — each touches
different files and needs its own review. Work in priority order (1 → 10); 1–3 are the ones
a judge is most likely to score you down for.

---

## 1. Appointment scheduling (currently: walk-in token queue only)

**Problem statement asks for:** "appointment **and** queue management."
**Current state:** [app/queue/page.tsx](../app/queue/page.tsx) only handles same-day walk-in
tokens generated at [app/opd/page.tsx](../app/opd/page.tsx) registration. There is no future
date/time booking anywhere in `app/`, `stores/`, or `lib/db.ts` — confirmed by grep, zero hits
for "appointment" or "booking".

**Build:**
- New IndexedDB store `appointments` in `lib/db.ts` (keyPath `id`, indexes `by-facility`,
  `by-date`, `by-patient`, `by-status`) following the existing store pattern (see `queue`
  store for the shape to copy).
- Type in `types/patient.ts` or a new `types/appointment.ts`: `{ id, patientId, facilityId,
  department, requestedDate, slot, status: 'REQUESTED'|'CONFIRMED'|'CANCELLED'|'CONVERTED_TO_TOKEN',
  createdVia: 'ASHA_BOOKED'|'SELF_REQUESTED', notes }`.
- New route `app/appointments/page.tsx`: a slot picker against a facility's daily capacity
  (derive capacity from `lib/data/facilities.ts`), booking form, and a list of upcoming
  appointments. Reuse `Sidebar`, `MobileMenu`, `Icon`, `t()` i18n pattern from any existing
  page (e.g. `app/followup/page.tsx` is a good template).
- On the appointment's date, it should surface in `/queue` as a pre-registered token
  ("Confirmed appointment — check in") rather than forcing a fresh walk-in registration.
- Add `appointments` to `stores/` as a new Zustand store (`appointmentStore.ts`) mirroring
  `queueStore.ts`.

**Acceptance:**
- [ ] Can book an appointment for a future date against a specific facility from `/opd` or
      a standalone flow.
- [ ] Appointment appears in a facility-scoped list, sorted by date/slot.
- [ ] On check-in day, converting an appointment to a queue token does not duplicate the
      patient record.
- [ ] Works fully offline (IndexedDB only, no network dependency).
- [ ] i18n strings added for en/hi/mr in `lib/i18n.ts`.

---

## 2. Health-service awareness content (currently: none)

**Problem statement explicitly names** "limited awareness of available services" as a root
cause of poor access. Grep across `app/` and `lib/` for "awareness" / "literacy" / "education"
returns zero matches — there is no in-app surface telling a patient or ASHA worker what
services, camps, or entitlements exist at each tier.

**Build:**
- New route `app/services-info/page.tsx` (or extend `app/facilities/page.tsx`) that lists,
  per facility tier (SC/PHC/CHC/SDH/DH), what services are actually available there — OPD
  hours, immunization days, ANC camp schedule, specialist visiting days, diagnostic tests
  offered. Static seed data is fine (`lib/data/facilities.ts` already has facility records —
  extend the type with a `servicesOffered: string[]` and `campSchedule` field).
- Surface a short "what am I entitled to here" card on the patient-facing flow after
  triage/registration in `app/opd/page.tsx`, driven by `recommendedFacilityTier` from
  `lib/triage/model.ts`.
- Voice/multilingual: reuse the existing Web Speech + `lib/i18n.ts` pattern so this reads
  aloud in Marathi/Hindi for low-literacy users — this is the single most direct way to hit
  the PS's "health literacy" phrase.

**Acceptance:**
- [ ] A patient or ASHA worker can see, without navigating away, what services + next camp
      date are available at their assigned facility.
- [ ] Content is multilingual (en/hi/mr) and works offline (static seed data, no fetch).

---

## 3. Affordability / entitlement transparency (currently: none)

**Problem statement explicitly names affordability** as an access barrier. Grep for
"scheme" / "Ayushman" / "PMJAY" / "cost" / "afford" across `app/` returns zero matches —
nothing in the product tells a patient what is free or subsidized.

**Build:**
- Extend the patient record / OPD flow to flag scheme eligibility: Ayushman Bharat-PMJAY
  card status, whether the recommended treatment tier is free-of-cost at a public facility,
  and which drugs on the prescription are free IPHS essential medicines (cross-reference
  `lib/data/` medicine seed data — `isEssentialIPHS` already exists per the dashboard code
  at `app/dashboard/page.tsx:93`, reuse it).
- A simple banner/card on `app/medicine/page.tsx` and the OPD summary: "✅ Free at this PHC
  under IPHS" vs "⚠️ Referral required — carry PMJAY card" is enough for a hackathon
  scope — don't build real scheme-verification integration.

**Acceptance:**
- [ ] Patient-facing screen shows, in plain multilingual language, whether their care path
      is free/subsidized.
- [ ] No real payment or scheme-verification API is called — this is a static/local
      eligibility display only (avoid overbuilding a compliance surface you can't back).

---

## 4. Accountability / audit trail (currently: none)

**Current state:** `lib/db.ts` has stores for `patients`, `referrals`, `queue`, `facilities`,
`medicineStock`, `diagnostics`, `syncQueue` — no `auditLog` store. Every write (triage
override, referral status change, medicine dispensed, patient record edit) is silently
untracked. The PS asks the solution to strengthen "accountability" in the public system;
right now there is no way to answer "who changed this and when."

**Build:**
- New IndexedDB store `auditLog` (keyPath `id`, index `by-entity`, `by-timestamp`,
  `by-actor`) recording `{ id, entityType: 'PATIENT'|'REFERRAL'|'QUEUE'|'MEDICINE',
  entityId, action, actorId, actorRole, timestamp, before?, after? }`.
- A thin `logAudit(...)` helper in `lib/db.ts`, called from the existing mutation functions
  (`saveReferral`, `updateReferralStatus`, `updateQueueStatus`, medicine stock updates) —
  wrap, don't rewrite, the existing write paths.
- A read-only `app/audit/page.tsx` (admin/MO role only, gate on the role stored at login —
  see `app/staff/login/page.tsx`) listing recent changes per entity.

**Acceptance:**
- [ ] Every referral status change and medicine stock update produces one audit row.
- [ ] Audit view is role-gated (not visible to ASHA/ANM roles).
- [ ] No PII beyond what's already in the entity is duplicated into the log unnecessarily.

---

## 5. Fix dashboard metric integrity bugs (currently: misleading, not missing)

This is a **correctness bug**, not an unbuilt feature — worth fixing before any demo since a
judge who checks the math will catch it.

**Current state in [app/dashboard/page.tsx](../app/dashboard/page.tsx):**
- Line ~93-100 correctly **computes** `avgWaitMinutes` and `waitTimeScore` from real
  `registeredAt`/`calledAt` timestamps.
- But line ~126 shows a **hardcoded literal string** `'Avg. Wait Time: 16 mins'` (and the
  hi/mr translations of the same fixed "16") instead of interpolating the computed
  `avgWaitMinutes` value. The label is completely disconnected from the number the code
  just computed two lines above it.
- `criticalFollowups` uses `redCount || 2` — if there are genuinely **zero** critical
  patients, the dashboard fabricates and displays "2 Critical" anyway. On a government
  monitoring dashboard this is a real integrity problem, not a placeholder.

**Build:**
- Replace the hardcoded `avgWait` string with a template that interpolates
  `avgWaitMinutes` (falling back to an explicit "No data yet" state when
  `waitSamples.length === 0`, not to a fake number).
- Remove the `|| 2` fallback on `redCount`; render an explicit zero-state
  ("No critical alerts") instead of substituting a fake count.
- Grep the rest of `app/dashboard/page.tsx` for any other `||` fallback to a non-zero
  literal on a metric and fix the same way.

**Acceptance:**
- [ ] Every number displayed on `/dashboard` traces to a real computed value or an explicit
      "no data" state — never a hardcoded placeholder presented as live data.

---

## 6. Label FHIR/ABDM honestly, or add a real sandbox stub

**Current state:** [lib/fhir.ts](../lib/fhir.ts) generates a structurally valid FHIR R4
JSON bundle with an ABDM profile URL in `meta.profile`. There is **no actual call** to an
ABDM sandbox, no consent-manager flow, no HIP/HIU registration — it's a local export only.

**Build (pick one):**
- **(a) Minimum — honest labeling:** rename any UI copy from "ABDM Integrated" /
  "ABDM Compliant" to "ABDM-ready export (FHIR R4)" wherever `generateFHIRBundle` is
  surfaced (check `components/shared/FHIRModal.tsx`). This alone removes a claim a judge
  can disprove in 30 seconds.
- **(b) Stretch — real sandbox call:** if time allows, wire a mock/sandbox ABDM
  Milestone-1 consent-flow stub (even a local fixture server) so the export is at least
  POSTed somewhere and a response is shown, rather than only downloaded as a file.

**Acceptance:**
- [ ] No UI copy claims live ABDM integration unless (b) is actually done.
- [ ] `FHIRModal.tsx` copy accurately describes what happens (local generation + download).

---

## 7. Teleconsult: real signaling, or label as structured async consult

**Current state:** [app/teleconsult/page.tsx](../app/teleconsult/page.tsx) (355 lines) is a
UI shell — vitals sync display, structured notes, low-bandwidth mode toggle — with no
`RTCPeerConnection`/WebRTC signaling server behind it. Grep for `RTCPeerConnection`,
`getUserMedia`, or a signaling channel in `app/teleconsult` and `lib/` returns nothing beyond
UI state.

**Build (scope to hackathon time budget):**
- Minimum: use the existing optional `server/mesh-server.ts` Socket.io channel (already in
  the repo for mesh relay) to carry WebRTC signaling (offer/answer/ICE) between two browser
  tabs, and call `navigator.mediaDevices.getUserMedia` for actual audio/video capture. This
  reuses infrastructure that already exists — don't stand up a separate signaling stack.
- If time doesn't allow real peer connection, change UI copy from "Video Consultation" to
  "Structured Consult Request" so it doesn't over-claim a live video call that isn't wired.

**Acceptance:**
- [ ] Either two browser sessions can actually exchange live audio/video via the mesh
      server, OR the UI no longer implies a live video call is happening.

---

## 8. Referral transport: live status instead of a hardcoded vehicle

**Current state:** [app/referrals/page.tsx](../app/referrals/page.tsx) hardcodes
`ambulanceVehicleNo` default `'MH-33-E-1081'` and has no live location feed — `transportStatus`
in `types/patient.ts` only moves between `PENDING`/`IN_TRANSIT`/`COMPLETED` on manual button
press, not from any GPS/telemetry source.

**Build:**
- Make vehicle number a required, non-defaulted input when a referral moves to
  `IN_TRANSIT` (don't silently reuse the same fake plate for every referral).
- Add a `lastUpdatedAt` + optional `etaMinutes` field the sending facility can update
  manually (simulating dispatcher radio contact) — this is enough for a hackathon; don't
  attempt real GPS integration with 108/102 fleets, that's outside scope.
- Show elapsed transit time on the Kanban card, computed from `IN_TRANSIT` timestamp to now
  (same pattern as the wait-time computation in `app/dashboard/page.tsx`).

**Acceptance:**
- [ ] No two referrals silently share the same placeholder vehicle number.
- [ ] Transit cards show real elapsed time, not a static label.

---

## 9. SMS fallback: note the real gateway gap

**Current state:** [lib/sms/fallback.ts](../lib/sms/fallback.ts) compresses patient data to
<160 chars and opens the device's native SMS composer (`sms:` URI) — there is no backend SMS
gateway (Twilio/MSG91/etc.), so this only works on a phone with a SIM, not from a desktop
kiosk or a facility computer.

**Build:**
- Document this limitation explicitly in the UI (a tooltip: "Opens your phone's SMS app —
  works on mobile devices with SIM connectivity") so it isn't mistaken for a server-side
  gateway during a demo.
- Optional stretch: add a mock gateway endpoint in `server/` that logs what *would* have
  been sent, so a desktop demo can show the compressed payload without needing a phone.

**Acceptance:**
- [ ] UI is explicit about the device-composer limitation.
- [ ] (Stretch) A logged mock-gateway path exists for desktop demos.

---

## 10. Mesh relay: default-on demo mode

**Current state:** Cross-facility sync (`lib/mesh/client.ts`, `server/mesh-server.ts`) is
real but **opt-in** — the app runs "STANDALONE" unless someone manually runs
`npm run server`. For a judge clicking through the app on one laptop, the "continuum of
care" story (SC→PHC→CHC→DH) never actually demonstrates cross-facility sync.

**Build:**
- Add an `npm run dev:full` script that starts both the Next.js dev server and
  `server/mesh-server.ts` concurrently (use `concurrently` or two `&`-chained commands in
  `package.json`), so the default local dev experience shows "Mesh Relay Online" without
  extra manual steps.
- Update `README.md`'s Getting Started to lead with this combined command.

**Acceptance:**
- [ ] `npm run dev:full` (or equivalent) brings up both processes and the dashboard shows
      "Mesh Relay Online" without a second manual terminal command.

---

## Priority order for a hackathon time budget

If you can't do all ten, do these in order — ranked by how directly each maps to language
the PS uses verbatim, and how quickly a judge can catch the gap:

1. **#5** (dashboard integrity bugs) — 15 min, removes a fabricated-data red flag
2. **#1** (appointments) — the PS names it explicitly alongside "queue management"
3. **#2 + #3** (awareness + affordability) — both named explicitly as root causes in the PS;
   can ship as one combined info screen to save time
4. **#6** (FHIR/ABDM honest labeling) — 10 min, prevents an easily-disproven claim
5. **#4** (audit log) — maps to the PS's "accountability" word directly
6. **#7, #8, #9, #10** — polish, do if time remains
