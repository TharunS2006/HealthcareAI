# 02 — Feature Prompts (Frontend + Backend per Module)

> **How to use:** copy ONE module block into a fresh chat/sprint. Each block is self-contained and references the
> Overview (data model, API conventions, RBAC, quality gates G1–G8). Build in the roadmap order (Overview §12).
> Every module MUST pass its Acceptance Criteria and the global quality gates before it is "done."

---

# M0 — Identity, Access, Roles & Consent (ABHA / OTP)

**Maps to:** "interoperable health records based on approved standards" (ABDM), "accountability", "strengthening the public system".

**Roles:** All (R1–R10).

**Frontend instruction**
- Citizen login: `/login` — phone → OTP (4/6-digit `OTPInput` with resend timer) OR ABHA address/ID. After login, show consent screen (checkboxes: record-sharing across govt facilities, teleconsult consent, SMS reminders) — stored as `consent_flags`.
- Staff login: `/staff/login` — phone + password/OTP; after login land on role home.
- Route guards: unauthorized role → "Access denied" screen; unauthenticated → redirect to login.
- Profile chip in header shows name + role + facility.

**Backend instruction**
- `POST /auth/otp/request` {phone} → rate-limited (5/10 min), sends OTP (mock: log it).
- `POST /auth/otp/verify` {phone, otp} → JWT access (15 min) + refresh (7 d).
- `POST /auth/abha/verify` {abhaId|abhaAddress} → mock ABDM verify (documented contract) → JWT.
- `POST /auth/refresh` → new access token.
- `GET /me` → user, role, facility, permissions.
- `PATCH /patients/:id/consent` → update consent flags (audited).
- RBAC middleware resolves role → permission set; unauthorized = `403`.

**Edge cases (handle all)**
1. OTP expired / max attempts → clear message + resend after 30 s.
2. ABHA ID invalid checksum → reject with `VALIDATION_ERROR`.
3. Session expiry mid-flow → silent refresh, else redirect to login preserving intent.

**Acceptance criteria**
- [ ] Citizen logs in via OTP and via ABHA (mock), sees consent screen, flags persist.
- [ ] Staff login enforces role; unauthorized route returns 403 + hidden button.
- [ ] OTP rate-limit triggers after 5 attempts.
- [ ] Consent change is audited.

**Judge defense:** "Access is OTP/ABHA-based with explicit consent — aligned with ABDM and DPDP — and every role is enforced server-side, which is the accountability foundation."

---

# M1 — Assisted Teleconsultation

**Maps to:** "long travel distances", "shortages of specialists", "assisted teleconsultation", "reduced travel".

**Roles:** FHW (R2) operates; remote MO/Specialist (R4/R5) consults.

**Frontend instruction**
- FHW flow at SC/PHC: select patient → enter **pre-call vitals** (`VitalInput`: BP, temp, SpO2, weight) → view specialist availability calendar → "Start call" → `TeleconsultRoom`.
- `TeleconsultRoom`: Jitsi iframe (low-bandwidth mode) + left sidebar = patient summary + triage notes + vitals; right = doctor notes field; "End call" → auto-save note + vitals to LHR (Encounter with type=TELECONSULT).
- Screen-share of triage notes = the sidebar is mirrored to the doctor via a shared "consult summary" payload (not literal screen share) — document this.
- Specialist calendar: slots per specialist (create/block by R5/R8).

**Backend instruction**
- `GET /teleconsult/slots?specialist_id=&date=` → availability.
- `POST /teleconsult/sessions` {patient_id, specialist_id, slot_id} → creates Jitsi room token + Encounter (status=IN_PROGRESS).
- `PATCH /teleconsult/sessions/:id` {vitals, notes, outcome, prescription?} → finalize; writes Encounter + Observations (vitals) + optional Prescription to LHR (audited).
- `GET /teleconsult/sessions/:id` → consult summary payload shared between FHW & doctor.

**Edge cases**
1. Specialist unreachable / no network at call time → offer "convert to referral + send LHR summary" fallback.
2. Call drops → session stays IN_PROGRESS; resume or finalize; never lose entered vitals (draft saved locally).
3. No specialist slots today → show next available + suggest referral or in-person MO.

**Acceptance criteria**
- [ ] FHW can start a call with vitals pre-entered; doctor sees patient summary sidebar.
- [ ] End-call saves vitals + notes to LHR automatically.
- [ ] Offline at call time → referral fallback offered.
- [ ] Session lifecycle audited (start, finalize).

**Judge defense:** "It's *assisted* — the health worker is in the loop, which respects low health literacy and connectivity, and keeps the public system as the access point."

---

# M2 — Appointment & Queue Management

**Maps to:** "appointment and queue management", "reduced travel and waiting time".

**Roles:** Citizen (R1) books/views; staff (R3/R4) run the queue.

**Frontend instruction**
- Citizen: `/queue` — pick facility + department (dropdown from Facility hierarchy) → pick slot → confirm → receive **token number** (`QueueTicket` with position + est. wait).
- Live queue view: token, position, "Now serving" — updates via polling (10 s) or SSE.
- Staff queue board: list of WAITING tokens → **Call next**, **Mark served**, **Mark no-show**.
- Reschedule/cancel from citizen view (if status still WAITING).
- SMS notification on booking and when token is 2 positions away (Module M11 channel).

**Backend instruction**
- `GET /facilities/:id/departments` → depts with today's slots & avg wait.
- `POST /appointments` {patient_id, facility_id, department, slot} → creates Appointment + QueueToken (idempotent).
- `GET /queue/:facility_id/:department?status=` → live tokens.
- `POST /queue/:token_id/call` · `/serve` · `/no-show` → state change (audited), recalculates `estimated_wait_min`.
- `PATCH /appointments/:id` → reschedule/cancel (only if WAITING).
- SMS via `Notification` (channel=SMS) on booking + "2 away".

**State machine:** `WAITING → CALLED → SERVED | NO_SHOW` (NO_SHOW/CANCELLED terminal).

**Edge cases**
1. Department full → show next available slot/facility (Service Discovery tie-in).
2. Patient no-show → token marked NO_SHOW; not counted in wait calc.
3. Double booking (idempotency) → same token returned, no duplicate.
4. Token called while patient offline → SMS fallback + staff can call next after 60 s.

**Acceptance criteria**
- [ ] Citizen books and gets a token; sees live position.
- [ ] Staff can call/serve/no-show; state transitions audited.
- [ ] Idempotent booking (double-click → one token).
- [ ] SMS triggered on booking + 2-away (mock logged).

**Judge defense:** "Token-based queue with live position + SMS cuts both travel and waiting time — the two explicit outcome words."

---

# M3 — Digital Triage Engine

**Maps to:** "digital triage", "health literacy", "earlier consultation".

**Roles:** FHW (R2) operates on patient's behalf (assisted); optional citizen self-use.

**Frontend instruction**
- `SymptomPicker` icon grid (fever, cough, chest pain, bleeding, pregnancy, infant, breathing difficulty…) + voice input (STT) + age/sex/pregnancy toggle.
- Decision flow = question tree (rule-based, transparent). Output screen: **urgency tier** (ROUTINE / PRIORITY / EMERGENCY) with color + icon, suggested department/specialist, and a clear next action button (Book queue / Start teleconsult / **Emergency now**).
- If EMERGENCY → jump to Emergency escalation (M13) pre-filled.
- `ReadAloudButton` reads the result (health literacy).

**Backend instruction**
- `POST /triage/assess` {patient_id, symptoms[], answers[], age, sex, pregnant} → rule engine returns {urgency_tier, suggested_department, red_flags[]} and stores TriageAssessment (audited).
- Rule set stored as versioned config (JSON) — editable without redeploy; document ≥ 20 rules incl. red flags (chest pain, severe bleeding, breathlessness, fever+infant, high BP in pregnancy…).
- `GET /triage/assessments?patient_id=` → history.

**Edge cases**
1. Contradictory/insufficient answers → engine asks clarifying question (max 3) before concluding.
2. Red flag detected mid-flow → immediately surface EMERGENCY + stop questionnaire.
3. Voice STT misrecognizes → allow icon re-entry (never block on voice).
4. Engine down → FHW can still manually set urgency (degraded mode, flagged in audit).

**Acceptance criteria**
- [ ] ≥ 20 rules incl. red flags; rule engine returns tier + dept.
- [ ] EMERGENCY result one-taps into M13 with LHR summary.
- [ ] Voice input + read-aloud both work for a low-literacy flow.
- [ ] Assessment persisted to LHR + audited.

**Judge defense:** "Triage addresses health literacy and routes patients correctly *before* a delayed referral can occur — producing the 'earlier consultation' outcome."

---

# M4 — Longitudinal Patient Health Record (LHR)

**Maps to:** "fragmented medical records", "without continuity of information", "longitudinal patient records".

**Roles:** Write R2–R5 (role-scoped); read R1 (own record) & staff.

**Frontend instruction**
- Patient 360° page: identity card (name, ABHA, blood group, allergies banner in red, chronic conditions), timeline of Encounters, tabs: Visits · Prescriptions · Diagnostics · Referrals · Immunizations · Vitals chart (Recharts line).
- Allergies/conditions shown as **prominent banner** on every clinical screen (never buried).
- Citizen `/record`: OTP/ABHA login → read-only mirror of own record.

**Backend instruction**
- `GET /patients/:id` (RBAC: citizen only self), `GET /patients/:id/timeline`, `GET /patients/:id/records?type=`.
- `POST /patients` (register, from M15/ASHA), `PATCH /patients/:id` (update allergies/conditions — audited).
- `POST /encounters` → visit record with vitals JSONB; `GET /encounters/:id`.
- Every other module (M1, M3, M5, M6, M8) writes *into* this record — enforce foreign keys so nothing is orphaned.
- FHIR export: `GET /patients/:id/fhir` → bundle of FHIR R4 resources (see Overview §6 mapping).

**Edge cases**
1. Duplicate patient registration (same phone) → fuzzy dedupe prompt (merge with confirm; audit merge).
2. Patient has no ID/ABHA → allow facility-assigned temp ID, promote later (link flow).
3. Concurrent writes from two facilities → last-write-wins on fields, append-only on timeline (never overwrite history).

**Acceptance criteria**
- [ ] One record aggregates visits across all 4 facility tiers.
- [ ] Allergies/conditions banner visible on every clinical screen.
- [ ] FHIR bundle export matches Overview mapping.
- [ ] Merge/dedupe flow exists + audited.

**Judge defense:** "This is the backbone the whole statement pivots on — one record per patient across every tier, solving 'fragmented records' and 'without continuity of information'."

---

# M5 — Referral Tracking & Escalation

**Maps to:** "delayed referrals", "referral tracking", "improved referral completion".

**Roles:** Initiate R2–R4; acknowledge/accept/complete R4–R5; oversight R9.

**Frontend instruction**
- `ReferralForm`: from-facility (auto), to-facility dropdown (filtered: only higher/same tier per hierarchy), urgency (ROUTINE/PRIORITY/EMERGENCY), reason, clinical summary (auto-prefilled from LHR).
- `Timeline` component renders states with timestamps.
- Staff lists: **Outgoing** (my facility) and **Incoming** (to my facility) with filters by status.
- Alert badge if any referral sits unacknowledged > threshold.
- Completion form: outcome + **feedback sent back to referring facility** (required before state=COMPLETED).

**Backend instruction**
- `POST /referrals` → state `REFERRED` (audited; idempotent).
- `GET /referrals?facility_id=&role=incoming|outgoing&status=` .
- State transitions (audited, timestamped):
  `REFERRED → ACKNOWLEDGED → PATIENT_TRAVELING → REACHED → CONSULTED → COMPLETED`
  (also allow `CANCELLED`).
- `PATCH /referrals/:id/transition` {to_state, note} — validates legal transitions only.
- Scheduler job: referrals in REFERRED/ACKNOWLEDGED > 24 h → notify District Admin (R9) + flag (escalation).

**Edge cases**
1. Unacknowledged > threshold → auto-escalation notification to R9 (never silently lost).
2. Patient no-shows at destination → state back to REFERRED (re-route) with reason.
3. Emergency referral → skip normal states, notify receiving facility immediately (SMS + in-app).
4. Destination facility lacks capacity → reject with reason → suggest alternative (Service Discovery).

**Acceptance criteria**
- [ ] Full state machine works with timestamps at each step.
- [ ] Feedback loop back to referring facility is mandatory to complete.
- [ ] Unacknowledged >24h triggers district escalation.
- [ ] Completion rate metric derivable for dashboards.

**Judge defense:** "Time-stamped, trackable, escalation-backed referral chain directly solves 'delayed referrals' and produces the 'improved referral completion' KPI."

---

# M6 — Diagnostic Coordination

**Maps to:** "irregular diagnostics", "diagnostic coordination", "improved diagnostic availability visibility".

**Roles:** Order R3–R4; process R7; view R1–R4.

**Frontend instruction**
- Order form: patient → test (catalog: CBC, blood sugar, HbA1c, urine, malaria/RDT, TB, ultrasound…) → nearest lab/facility (auto-suggest; if unavailable locally, suggest nearest alternative with distance).
- Lab tech board: sample collection → processing → result ready → result delivered.
- Result entry: values form or report upload → push to LHR.
- Citizen/patient view: test status timeline + result.

**Backend instruction**
- `GET /diagnostics/catalog` · `GET /diagnostics/availability?test_code=&near=` (from Facility metadata).
- `POST /diagnostic-orders` → state `ORDERED` (idempotent; audited).
- State machine: `ORDERED → SAMPLE_COLLECTED → PROCESSING → RESULT_READY → DELIVERED` ( + `CANCELLED`).
- `POST /diagnostic-orders/:id/transition` (validated).
- `POST /diagnostic-orders/:id/result` {observations, report_url} → creates DiagnosticResult + Observations in LHR (audited).
- If `RESULT_READY` → notify patient + ordering facility (SMS/in-app).

**Edge cases**
1. Test unavailable at chosen facility → suggest nearest with live availability (never dead-ends).
2. Sample lost/rejected → `REJECTED` state + reason + auto re-order prompt.
3. Result overdue (PROCESSING > SLA) → notify lab + ordering MO.
4. Patient offline → result pushed on next sync + SMS summary.

**Acceptance criteria**
- [ ] Full state machine + status timeline.
- [ ] Results auto-push into LHR.
- [ ] Unavailable test suggests nearest alternative facility.
- [ ] Overdue/rejected paths handled.

**Judge defense:** "Sample-to-result tracking with nearest-lab routing solves 'irregular diagnostics' and gives live test availability visibility."

---

# M7 — Medicine / Drug Availability Tracker

**Maps to:** "medicine availability", "affordability", "improved medicine/diagnostic availability visibility".

**Roles:** Update R6/R8; view all (public).

**Frontend instruction**
- Pharmacist: stock update screen (drug from Essential Drug List, quantity, threshold) — quick +/-, batch update.
- Public `/medicine`: search drug → list of facilities with AVAILABLE / LOW / OUT badge + distance.
- Low/out-of-stock triggers a badge on facility dashboard.

**Backend instruction**
- `GET /stock?drug_code=&facility_id=&near=` (public endpoint, no PHI).
- `PUT /stock/:facility_id/:drug_code` {quantity} → update + audit (who, when).
- Low-stock alert when `quantity ≤ threshold` → notify facility admin + district (R8/R9).
- `GET /stock/summary` → % facilities with live stock status (dashboard metric).
- Seed with National Essential Medicines List (NLEM) subset.

**Edge cases**
1. Out of stock locally → show "available at [nearest facility]" (prevents wasted trips).
2. Stale stock (not updated > 7 days) → mark "unverified" rather than silently wrong.
3. Concurrent updates from two pharmacists → atomic update, last-write with audit.

**Acceptance criteria**
- [ ] Public lookup shows per-facility availability with badges.
- [ ] Stock update audited; low-stock alert fires.
- [ ] Out-of-stock suggests nearest alternative.
- [ ] "Unverified" state for stale data.

**Judge defense:** "Facility-wise live stock with nearest-alternative routing solves 'medicine availability' and 'affordability' (no wasted trips), producing the visibility outcome."

---

# M8 — High-Risk Follow-Up & Recall Engine (Maternal / Child / NCD)

**Maps to:** "high-risk patient follow-up", "better follow-up for maternal, child and chronic conditions".

**Roles:** Assign/complete R2–R3; oversight R8–R9.

**Frontend instruction**
- FHW home shows **today's task list**: "Visit/call these 5 patients" grouped by cohort (Maternal ANC/PNC, Child immunization, NCD recall) with overdue in red.
- Task detail: patient summary, due item (ANC visit #2, DPT booster, BP check), actions: Mark completed / Snooze / Skip (reason required).
- Enroll screen: add patient to cohort with schedule (auto-generated per national schedule).

**Backend instruction**
- `POST /cohorts/enroll` {patient_id, cohort, schedule_override?} → CohortMembership + generate FollowUpTasks from schedule.
- Schedules (config): Maternal = ANC at 8/12/16/20/24/28/32/36/40 weeks + PNC at 7/14/21/28 days; Child = immunization at 6/10/14 weeks, 9, 16 months…; NCD = recall every 30/60/90 days by condition (DM/HTN/TB).
- `GET /followups?assigned_fhw=&status=&due_before=` · `POST /followups/:id/complete` · `/snooze` · `/skip` (audited).
- Nightly job: mark DUE → OVERDUE past due_date; send SMS reminder to patient + task to FHW.
- Compliance metric: `completed_on_time / due` per cohort (dashboard).

**Edge cases**
1. Patient migrated/absent → SKIP with reason (counted separately, not as completed).
2. Overdue task auto-flags district after 7 days.
3. SMS to wrong/unreachable number → retry ×3 then fall back to FHW in-app reminder.
4. High-risk flag (e.g., high BP pregnancy) → task escalated to MO, not just FHW.

**Acceptance criteria**
- [ ] Three named cohorts with auto-generated schedules.
- [ ] FHW task list + complete/snooze/skip (reason required).
- [ ] Overdue escalation + SMS reminders.
- [ ] Per-cohort compliance % metric feeds dashboards.

**Judge defense:** "The statement names 'maternal, child and chronic' follow-up explicitly — so this engine has exactly those three cohorts, with recall schedules and compliance metrics."

---

# M9 — Facility & Administrative Dashboards

**Maps to:** "facility dashboards", "quality", "accountability", "enhanced quality monitoring".

**Roles:** R8 (facility), R9 (district).

**Frontend instruction**
- Facility dashboard: patient load today, referral completion %, stock status, teleconsult volume, avg wait, follow-up compliance.
- District dashboard: aggregated quality scorecard (per facility: referral completion, follow-up compliance, stock freshness, wait time trend), heatmap/table, drill-down.
- Charts via Recharts; all have loading/empty states; "last updated" timestamp.

**Backend instruction**
- `GET /dashboards/facility/:id` · `GET /dashboards/district` (aggregated SQL views, cached 60 s).
- Scorecard formula documented (weighted composite; configurable weights).
- **All dashboard reads are audit-logged** (who viewed, when — accountability).
- No PHI in district aggregation (privacy by design).

**Edge cases**
1. No data yet (new facility) → empty states with "no data in period", not zero-blame charts.
2. Scorecard changes over time → store snapshots (daily) for trend line.
3. Large district → paginate facility table.

**Acceptance criteria**
- [ ] Facility + district dashboards render all 6 metric groups.
- [ ] Quality scorecard with documented formula + trend over time.
- [ ] Dashboard views audited; no PHI at district level.

**Judge defense:** "Role-based facility and district dashboards with a documented quality scorecard deliver 'quality', 'accountability' and 'enhanced quality monitoring'."

---

# M10 — Frontline Health Worker (FHW) Companion App

**Maps to:** "support frontline health workers", "constrained staff and equipment".

**Roles:** R2 (ASHA/ANM/CHO) primarily.

**Frontend instruction**
- Lightweight, mobile-first shell = role home with: today's follow-up tasks, quick actions (register patient, assisted triage, teleconsult, create referral), offline badge, sync status.
- Patient search (name/phone/ABHA, works offline on cached index).
- One-handed design (44px+ targets), low data usage, < 300 KB shell.
- Everything works offline: task list + patient cache + draft forms.

**Backend instruction**
- `GET /fhw/tasks` (follow-ups + referrals awaiting + today's teleconsults), `GET /fhw/sync-status`.
- All FHW actions route through existing modules (no new domain logic) — this module is the **shell + offline UX**, proving "works with minimal staff and low-end devices."

**Edge cases**
1. First login offline → show cached/skeleton + "sync when online" (never blank).
2. Phone battery/data constrained → every list paginates to 20; images lazy.

**Acceptance criteria**
- [ ] FHW completes register → triage → teleconsult → referral entirely on a 360px screen.
- [ ] Full flow works offline with sync-on-reconnect.
- [ ] Shell < 300 KB gzipped.

**Judge defense:** "The statement names 'support frontline health workers' — this is the ASHA/ANM/CHO-facing shell through which the system strengthens, not replaces, the public system."

---

# M11 — Offline-First / Low-Connectivity Architecture

**Maps to:** "Connectivity", "low-connectivity environments".

**Roles:** Cross-cutting (all).

**Frontend instruction** — see Frontend prompt §5 (service worker, IndexedDB, write queue, offline banner, sync badge).

**Backend instruction**
- `GET /sync?since=<cursor>` → changed entities since cursor (per facility scope), paginated.
- `POST /sync/upload` → replay queued client writes with `Idempotency-Key` + client timestamps; returns per-item results (applied / rejected with reason).
- Conflict policy: last-write-wins on scalar fields; append-only for timeline/referral states (reject illegal transitions with `422`).
- SMS/USSD fallback: `POST /notify` {channel: SMS} for appointment confirm + emergency alerts where data is absent (mock gateway logs).

**Edge cases**
1. Duplicate replays → idempotency prevents duplicates.
2. Stale client (cursor too old) → server returns `409` → client re-pulls full snapshot.
3. Illegal state transition from offline client → `422` + explanation surfaced to user.

**Acceptance criteria**
- [ ] Airplane-mode demo: register/task work offline; reconnect syncs without duplicates.
- [ ] SMS fallback demonstrated (mock log) for booking + emergency.
- [ ] Sync cursor + conflict policy implemented.

**Judge defense:** "'Low-connectivity environments' is explicit — so offline sync + SMS fallback is demoed live with an airplane-mode toggle, not just claimed."

---

# M12 — Multilingual & Voice Interaction Layer

**Maps to:** "language", "multilingual interaction", "health literacy".

**Roles:** Cross-cutting.

**Frontend instruction** — see Frontend prompt §4 (i18next EN/HI/TA, language switcher, Web Speech STT/TTS, `ReadAloudButton`).

**Backend instruction**
- `GET /i18n/:locale` → serves translation bundles (or bundles ship with the app; API optional for content updates).
- Voice: mock Bhashini-style ASR/TTS endpoint contract documented (if real keys unavailable, use Web Speech client-side).
- All SMS templates localized by patient's preferred language (`Notification.template_key` + locale).

**Edge cases**
1. Missing translation key → fall back to EN (never show raw key).
2. STT fails (no mic/no network) → icon fallback always available.
3. Date/number localization correctness across HI/TA.

**Acceptance criteria**
- [ ] Full UI switches EN ⇄ HI ⇄ TA instantly with no hard-coded strings.
- [ ] Voice input + read-aloud work on triage & record screens.
- [ ] SMS templates localized.

**Judge defense:** "'Language' and 'multilingual interaction' are explicit — the entire UI is key-based EN/HI/TA with voice in/out for low literacy."

---

# M13 — Emergency Escalation

**Maps to:** "emergency escalation".

**Roles:** Trigger R1/R2 (anyone); receive R4/R9/ambulance (mock).

**Frontend instruction**
- Red `Emergency FAB` on **every screen** → confirm dialog ("Send emergency alert with your last known health summary?") → one tap.
- Pre-fills: patient (if logged in), location (geolocation or facility), LHR summary snapshot (allergies, chronic conditions, blood group).
- Sends alert to nearest higher-tier facility + mock 108 ambulance; shows "Alert sent — receiving facility notified" with tracking.

**Backend instruction**
- `POST /emergency/alerts` {patient_id?, location, level, lhr_summary_snapshot} → create EmergencyAlert, notify nearest higher-tier facility (SMS + in-app) + 108 (mock), share snapshot.
- `GET /emergency/alerts?facility_id=&status=` for receiving facilities.
- `PATCH /emergency/alerts/:id` → receiving facility acknowledges/dispatches (audited).

**Edge cases**
1. Anonymous/guest (no login) → still sends alert with location only (never block on login).
2. No network → try SMS fallback (mobile deep link) then queue for sync.
3. Wrong/duplicate taps → confirm dialog + idempotency.

**Acceptance criteria**
- [ ] FAB reachable from every screen; one-tap with confirm.
- [ ] LHR summary snapshot shared with receiving facility.
- [ ] Guest trigger + offline SMS fallback work.
- [ ] Full lifecycle audited.

**Judge defense:** "'Emergency escalation' is explicit — a one-tap, always-accessible flow that instantly shares the LHR summary with the nearest higher facility."

---

# M14 — Interoperability Layer (ABDM / FHIR)

**Maps to:** "interoperable health records based on approved standards".

**Roles:** Technical/system; visible via FHIR export + ABHA linkage.

**Frontend instruction**
- Patient profile shows ABHA linkage status ("ABHA linked ✓ / not linked — link now").
- No other special UI — this module is mostly backend contract.

**Backend instruction**
- Prisma schema shaped as FHIR R4 resources (Overview §6 mapping) — `Observation`, `MedicationRequest`, `ServiceRequest`, `DiagnosticReport`, `Condition`, `Immunization`.
- `GET /patients/:id/fhir` → FHIR bundle (JSON, validated against a minimal R4 profile).
- `POST /abdm/link` (mock) → link ABHA ID/address to patient; `POST /abdm/consent` (mock) → record consent artifact.
- Document the **ABDM sandbox API contract** you would call in production (HIP/HIU flows) even if mocked.
- `GET /interop/manifest` → machine-readable capability statement (what resources you support).

**Edge cases**
1. ABHA verify failure → clear error, retry, don't corrupt patient record.
2. FHIR export of a patient with no data → valid empty bundle (not 500).

**Acceptance criteria**
- [ ] FHIR bundle export matches the Overview mapping and validates.
- [ ] ABHA link/unlink flow (mock) with consent artifact.
- [ ] Capability statement/manifest available.

**Judge defense:** "Judges will probe what 'approved standards' means in Indian public health — the answer is ABDM + FHIR R4, and our LHR is FHIR-shaped with ABHA linkage, documented contract included."

---

# M15 — Facility Hierarchy & Service Discovery

**Maps to:** "patients move between sub-centres, PHCs, rural hospitals and district hospitals", "limited awareness of available services".

**Roles:** Master data R10; discovery public + staff.

**Frontend instruction**
- Admin: manage facility tree (SC → PHC → CHC/RH → DH), each with services[], staff[], equipment[], timings, geo.
- Public `/services`: search by service (e.g., "ultrasound", "specialist", "TB treatment") or facility name → list + map with **"what is available where"**, distance, hours.

**Backend instruction**
- `GET /facilities?type=&district=&service=&near=` (public, no PHI).
- `GET /facilities/:id` → detail incl. services/staff/equipment.
- `POST /facilities` · `PATCH /facilities/:id` (R10; audited).
- Seed data: one district with 20–25 facilities across all 4 tiers (realistic names).

**Edge cases**
1. Search misspelling → fuzzy match suggestions.
2. Facility missing geo → fall back to district-level listing.

**Acceptance criteria**
- [ ] 4-tier hierarchy modeled exactly (SC/PHC/CHC/DH), not generic categories.
- [ ] Service discovery answers "what is available where" for any service.
- [ ] Master data changes audited.

**Judge defense:** "The statement names the 4-tier hierarchy explicitly — our data model mirrors Sub-Centre → PHC → CHC/Rural Hospital → District Hospital exactly, and discovery answers 'limited awareness of available services'."

---

## 📋 Demo Runbook (order the judge walkthrough)

1. Airplane mode ON → FHW opens app → offline task list loads (M11).
2. FHW registers a patient (ABHA mock) → LHR created (M0, M4).
3. Assisted triage via icons + voice → PRIORITY (M3, M12).
4. Book queue token → live position (M2).
5. Assisted teleconsult with remote specialist → vitals + notes saved to LHR (M1).
6. Specialist issues referral → timeline REFERRED → … → CONSULTED → feedback loop (M5).
7. Diagnostic order → sample → result pushed to LHR (M6).
8. Medicine lookup → "available at nearest PHC" (M7).
9. FHW follow-up tasks (maternal/child/NCD) → complete one → compliance % updates (M8).
10. Facility + district dashboards update live (M9).
11. One-tap emergency → LHR snapshot reaches receiving facility (M13).
12. Reconnect → sync uploads offline writes, no duplicates (M11).
