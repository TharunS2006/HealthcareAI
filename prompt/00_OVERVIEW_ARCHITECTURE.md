# 00 — Overview, Architecture & Standards (System Context Prompt)

> Feed this file FIRST as the system/context prompt. It pins the product, roles, stack, data model,
> API rules and the global quality bar. Every later module assumes this is already understood.

---

## 1. What Improved vs. the Original Prompt

| Original gap | Fix in v2 |
|---|---|
| Features described in one paragraph, no definition of done | Every module now has **frontend + backend instructions + acceptance checklist + edge cases** |
| No data model | Full **entity-relationship model + FHIR R4 mapping** |
| No API contract | **REST conventions, error envelope, idempotency, offline sync endpoints** |
| No security/privacy for health data | **DPDP Act / ABDM HDM alignment, RBAC, encryption, audit, consent** |
| "Government website" not defined | Explicit **GIGW-compliant citizen + staff portal** with official branding, helplines, accessibility |
| Tech stack was a menu of options | **Pinned stack** with justification (assistant won't guess) |
| No failure handling | **"Works at all costs" quality gate** + per-module edge cases |

---

## 2. Product Definition

**Product name:** *Gram Swasthya* (ग्राम स्वास्थ्य · கிராம சுகாதாரம்) — Integrated Rural & Underserved Area Public Healthcare Access, Continuity & Quality Platform.

**Form factor:** A **government website** (two portals) delivered as a Progressive Web App so it also works on low-end phones:

| Portal | Users | Access |
|---|---|---|
| **Citizen Portal** (`gramswasthya.gov.in`) | Patients, family members, general public | Public + OTP/ABHA login for personal features |
| **Staff Portal** (`staff.gramswasthya.gov.in`) | ASHA, ANM, CHO, MO, Specialist, Pharmacist, Lab Tech, Facility Admin, District Admin | Role-based login |

**Governing principles (non-negotiable):**
1. **Strengthen, not replace:** every workflow is operated by government staff (ASHA/ANM/CHO/MO) inside the government facility hierarchy. No bypass to private providers.
2. **One patient, one record:** the Longitudinal Health Record (LHR) follows the patient across Sub-Centre → PHC → CHC/Rural Hospital → District Hospital.
3. **Health-worker-assisted:** teleconsultation and triage are *assisted* by a frontline worker — not pure patient self-service.
4. **Standards-first:** records are FHIR-R4-shaped with ABHA (ABDM) linkage.
5. **Low-connectivity reality:** offline-first with SMS/USSD fallback.
6. **Health-literacy reality:** icon + voice UI, multilingual.

---

## 3. Roles & Permission Matrix

| # | Role | Typical person | Key permissions |
|---|---|---|---|
| R1 | **Citizen / Patient** | Any resident | View own LHR (OTP/ABHA), book/queue appointments, see referral status, find services, medicine availability lookup, emergency button |
| R2 | **ASHA / FHW** | Frontline worker | Register patients, assisted triage, assisted teleconsult, create referrals, run follow-up task list |
| R3 | **ANM / CHO** | Sub-Centre/PHC staff | All FHW perms + record vitals/encounters, order diagnostics, manage queue at their facility |
| R4 | **Medical Officer (MO)** | PHC/CHC doctor | Consult, prescribe, accept/complete referrals, view LHR, teleconsult as remote doctor |
| R5 | **Specialist** | District Hospital | Teleconsult specialist calendar, accept specialist referrals, second opinions |
| R6 | **Pharmacist** | Facility pharmacy | Update medicine stock, dispense against prescriptions |
| R7 | **Lab Technician** | Lab/CHC/DH | Update diagnostic sample/result status, upload reports |
| R8 | **Facility Admin** | Facility in-charge | Facility dashboard, staff at facility, queue config, stock oversight |
| R9 | **District Admin / DHO** | District HQ | District dashboard, quality scorecards, escalate stalled referrals |
| R10 | **System Admin** | Nodal/IT | User management, facility hierarchy master data, audit review |

> **Rule:** The backend must enforce RBAC server-side on EVERY endpoint (`403 FORBIDDEN` otherwise). The frontend hides buttons for unauthorized roles but must never rely on hiding alone.

---

## 4. Pinned Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript**, Tailwind CSS, React Router, i18next, Dexie.js (IndexedDB), Recharts, `vite-plugin-pwa` (Workbox) | Fast, PWA/offline out of the box, huge AI-assistant familiarity |
| Backend | **Node.js 20 + Express + TypeScript**, Prisma ORM | One language across stack = fewer bugs; Prisma gives typed, migration-safe schema |
| Database | **PostgreSQL 15** | Relational integrity for LHR/referrals/stock; JSONB for flexible vitals/observations |
| Auth | JWT (access + refresh) + **OTP via SMS** for citizens; role claims in token | No password burden on rural users |
| Interoperability | **FHIR R4-shaped Prisma schema** + mock ABDM/ABHA sandbox calls (documented contract) | Judges probe "approved standards" (ABDM/FHIR) |
| Teleconsult | **Jitsi Meet** (iframe/JS API, low-bandwidth mode) | Open source, no per-minute cost, works on 2G/3G |
| Notifications | **MSG91 / Twilio** SMS (mock in sandbox) + in-app + optional voice (IVR stub) | SMS fallback for low-connectivity |
| Offline sync | Service Worker + IndexedDB + `/sync` endpoints (cursor-based) | Explicitly demoed via airplane-mode toggle |
| Voice | Web Speech API (STT/TTS) frontend + optional Bhashini-style API (mock) | Free, works offline-ish, regional languages |
| Deploy | **docker-compose**: nginx (serves PWA) + API + Postgres (+ optional Jitsi) | One-command demo |

> **Swap note:** If your team prefers Django/FastAPI or Flutter, the **data model, API contract, edge cases and acceptance criteria in this pack remain 100% valid** — only the code snippets change.

---

## 5. System Architecture & Data Flow

```
                         ┌────────────────────────────────────────────────┐
  Citizen (low literacy) │        CITIZEN PORTAL (public PWA)             │
       │                 │  Service Discovery · Queue · Own Record ·      │
       ▼                 │  Medicine Lookup · Emergency · Voice/Icon UI   │
  ASHA / FHW ──────►     └───────────────┬────────────────────────────────┘
       │                                 │ HTTPS (REST /api/v1)
       ▼                                 ▼
  STAFF PORTAL (PWA)  ──►  ┌──────────────────────────┐      ┌──────────────────┐
  ASHA/ANM/CHO/MO/         │    API + Business Logic   │◄────►│  PostgreSQL 15   │
  Specialist/Pharm/Lab     │  (Node/Express + Prisma)  │      │  LHR · Referrals  │
  Admin dashboards         └──────┬───────────┬────────┘      │  Stock · Queue    │
                                  │           │               └──────────────────┘
                 ┌────────────────┘           └──────────────┐
                 ▼                                           ▼
        ┌─────────────────┐                          ┌─────────────────┐
        │ Jitsi (WebRTC)  │                          │ SMS gateway     │
        │ teleconsult     │                          │ + ABDM mock     │
        └─────────────────┘                          └─────────────────┘
                 Offline: Service Worker + IndexedDB ⇄ /sync (cursor) ⇄ server
```

**Data flow rules:**
1. Every patient interaction writes to the **LHR** (single source of truth).
2. Referrals/diagnostics/stock have **state machines** (see feature prompts) — never free-text status.
3. Every state change is **timestamped + role-attributed** (audit).
4. Offline devices queue writes locally and push on reconnect via `/sync/upload`.

---

## 6. Data Model (Entities)

| Entity | Key fields | Notes |
|---|---|---|
| **User** | id, role, facility_id, name, phone, license_no, languages[], active | One row per staff account; citizen = Patient entity |
| **Facility** | id, type (SC\|PHC\|CHC\|RH\|DH), parent_id, district, name, address, lat/lng, timings, services[], staff[], equipment[], contact | **Mirrors the 4-tier hierarchy exactly** |
| **Patient** | id, abha_id?, abha_address?, name, gender, dob, phone, blood_group, allergies[], chronic_conditions[], consent_flags, primary_facility_id, guardian | Linkable to ABHA |
| **Encounter (Visit)** | id, patient_id, facility_id, provider_id, date, type, chief_complaint, vitals(JSONB), notes | One per consultation |
| **TriageAssessment** | id, encounter_id, symptoms[], urgency_tier (ROUTINE\|PRIORITY\|EMERGENCY), suggested_department, done_by, timestamps | From Digital Triage engine |
| **Appointment** | id, patient_id, facility_id, department, slot, status, queue_token_id | Booking + queue link |
| **QueueToken** | id, facility_id, department, token_no, status (WAITING\|CALLED\|SERVED\|NO_SHOW), called_at, estimated_wait_min | Live queue |
| **Referral** | id, patient_id, from_facility, to_facility, reason, urgency, clinical_summary, status, timeline[](JSONB), feedback | State machine in Module 5 |
| **DiagnosticOrder** | id, patient_id, encounter_id, test_code, lab_facility, status, sample_id, result_ref | State machine in Module 6 |
| **DiagnosticResult** | id, order_id, observations(JSONB), report_url, fhir_ref | Pushes into LHR |
| **Prescription** | id, encounter_id, items[] (drug_code, dose, duration), issued_by | FHIR MedicationRequest |
| **StockItem** | id, facility_id, drug_code, drug_name, category (Essential Drug List), quantity, threshold, updated_by, updated_at | Medicine tracker |
| **CohortMembership** | id, patient_id, cohort (MATERNAL\|CHILD\|NCD), enroll_date, schedule(JSONB) | For follow-up engine |
| **FollowUpTask** | id, patient_id, cohort, due_date, type, status (DUE\|COMPLETED\|OVERDUE\|SKIPPED), assigned_fhw | Recall engine |
| **EmergencyAlert** | id, patient_id, triggered_by, location, level, dispatched_to[], status, lhr_summary_snapshot(JSONB) | One-tap emergency |
| **AuditLog** | id, actor_id, role, action, entity, entity_id, before, after, ip, facility_id, created_at | Append-only |
| **Notification** | id, recipient, channel (SMS\|INAPP\|VOICE), template_key, payload, status, retries | All channels |

### FHIR R4 Mapping (for Module 14)

| Our entity | FHIR resource |
|---|---|
| Patient | `Patient` |
| Facility | `Organization` + `Location` |
| User (staff) | `Practitioner` |
| Encounter | `Encounter` |
| Vitals / triage / lab values | `Observation` |
| Chronic conditions | `Condition` |
| Prescription | `MedicationRequest` |
| Referral | `ServiceRequest` |
| DiagnosticResult | `DiagnosticReport` |
| Immunization record | `Immunization` |

---

## 7. API Conventions

- Base URL: `/api/v1`
- Auth: `Authorization: Bearer <JWT>`. Citizen OTP login returns short-lived token + refresh token.
- Response envelope:
  ```json
  { "success": true, "data": { }, "meta": { "page": 1, "total": 42 } }
  { "success": false, "error": { "code": "BUSINESS_RULE", "message": "…", "details": { } } }
  ```
- Error codes: `400 VALIDATION_ERROR` · `401 UNAUTHENTICATED` · `403 FORBIDDEN` · `404 NOT_FOUND` · `409 CONFLICT` · `422 BUSINESS_RULE` · `429 RATE_LIMIT` · `500 INTERNAL` · `503 OFFLINE_REQUIRES_SYNC`
- **Idempotency:** all POSTs that create records accept `Idempotency-Key` header (retries must not duplicate referrals/orders).
- **Pagination:** `?page=&limit=` with `meta.total`.
- **Offline sync:** `GET /sync?since=<cursor>` → changed entities since cursor; `POST /sync/upload` → client-queued writes with client timestamps + `Idempotency-Key`.
- **Audit:** every mutating endpoint writes an AuditLog row. AuditLog is append-only (no UPDATE/DELETE).

---

## 8. Non-Functional Requirements

### Security & Privacy (health data = sensitive)
- HTTPS only; Argon2id password hashing; JWT expiry ≤ 15 min (refresh ≤ 7 days).
- **RBAC enforced server-side** on every endpoint.
- **No PHI in logs**; PII masked in UI for roles that don't need it (e.g., ASHA sees patient name, district admin sees aggregates only).
- Encryption at rest (Postgres `pgcrypto` for PHI columns) + TLS in transit.
- **Consent capture** on patient record (opt-in flags), aligned with **DPDP Act, 2023** and **ABDM Health Data Management Policy**.
- OTP rate limiting (max 5 attempts / 10 min) to prevent enumeration.
- Audit log immutable & exportable (accountability requirement).

### Accessibility & GIGW compliance (government website)
- **WCAG 2.1 AA** + **GIGW (Guidelines for Indian Government Websites)**.
- Screen-reader labels on every control, full keyboard navigation, focus rings, high-contrast mode, font-size toggle (A/A+), "Read aloud" button on key screens.
- Official header (tricolor + emblem + "Government of India"), footer with helplines (104 Health, 108 Ambulance, 112 Emergency), RTI, sitemap, accessibility statement, feedback/grievance link.

### Performance & Reliability
- LCP < 2.5s on 3G; JS bundle < 300 KB gzipped; API p95 < 500 ms.
- Offline cold-start < 3 s (IndexedDB boot).
- Every read has an **empty state** and **error state** with retry; no infinite spinners.
- Idempotent writes so double-clicks/retries never duplicate referrals or tokens.

---

## 9. Global Build Rules ("Works at All Costs" Quality Gate)

Apply to EVERY module. A module is **rejected** if any gate fails:

1. **G1 Validation** — server validates all inputs (types, ranges, enums); client mirrors it for UX.
2. **G2 Authorization** — endpoint checks role; unauthorized = `403`; UI hides the control.
3. **G3 Audit** — every write logged (actor, role, action, entity, timestamp, facility).
4. **G4 i18n** — zero hard-coded user-facing strings; EN + HI + TA keys present.
5. **G5 Offline** — behavior defined with no connectivity (works offline, or explicit "connect to continue" state).
6. **G6 States** — every screen defines loading / empty / error / success states.
7. **G7 Edge cases** — the 2+ listed edge cases per module are implemented and testable.
8. **G8 Demo-ready** — seeded data lets a judge see the feature working in < 60 seconds.

---

## 10. Outcome-to-Feature Traceability (improved)

| Expected outcome (exact) | Modules | Demo metric |
|---|---|---|
| Reduced travel & waiting time | Queue (M2), Teleconsult (M1), Service Discovery (M15) | Avg. wait min; est. km avoided |
| Earlier consultation | Triage (M3), Appointments (M2) | Symptom-report → consult time |
| Improved referral completion | Referral Tracking (M5) | % referrals reaching "Consulted" |
| Better follow-up (maternal, child, chronic) | Follow-Up Engine (M8) | % due follow-ups completed on time, per cohort |
| Improved medicine/diagnostic availability visibility | Medicine Tracker (M7), Diagnostics (M6) | % facilities with live stock/test status |
| Enhanced quality monitoring | Dashboards (M9) | Quality scorecard trend |

---

## 11. Judge Q&A (one-liners, updated)

- **"Doesn't this replace the public system?"** → Every flow is operated by ASHA/ANM/CHO/MO inside the government facility hierarchy; zero features bypass it.
- **"Where's interoperability?"** → LHR is modeled on FHIR R4 resources with ABHA-linkable patient IDs per ABDM; Module 14 documents the exact mapping.
- **"How does it work with no internet?"** → Offline-first IndexedDB + background sync + SMS fallback, demoed by toggling airplane mode live.
- **"Different from a generic telemedicine app?"** → It's *assisted* (health-worker-mediated) and folds queue + referral + diagnostics + medicine + follow-up into one continuity-of-care record.
- **"Accountability mechanism?"** → Append-only, role-attributed audit trail on every referral, follow-up and dashboard entry.
- **"Is it a real government website?"** → GIGW-compliant citizen + staff portals, official branding, helplines, accessibility, multilingual.

---

## 12. Build Order (dependency roadmap)

1. **M0** Identity/Auth/Roles · **M14** FHIR schema & ABHA stub · **M15** Facility hierarchy & seed data
2. **M4** LHR (patient + encounter) — backbone
3. **M3** Digital Triage → **M2** Appointment & Queue → **M1** Assisted Teleconsult
4. **M5** Referral Tracking → **M6** Diagnostics → **M7** Medicine Tracker
5. **M8** Follow-Up Engine → **M9** Dashboards → **M10** FHW app shell
6. **M11** Offline sync · **M12** Multilingual/Voice · **M13** Emergency
7. Polish: seed data, demo runbook, judge defense rehearsal
