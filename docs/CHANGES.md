# NalamMesh — every change made for real-world readiness

This lists everything changed on branch `claude/exciting-goodall-3vpqgq`, compared with the default branch `new`: **21 commits, 138 files, about 7,000 lines added and 1,750 removed**, made on 10–11 October 2026. Each item names the commit that made it, so you can open the exact change with `git show <commit>`.

**Where this leaves the project.** The software side is done and tested end to end in production mode, but NalamMesh is **not yet cleared for real patients**. That needs approvals only the team and the health department can obtain: a licence, clinical validation, CDSCO, a CERT-In audit, government hosting and ABDM certification. See [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md). The licence file was **not** changed. It still reserves all rights, and changing it is the team's decision.

## Update, 26 October 2026 — what the trial found

A structured review put the proposal *"NalamMesh should be adopted by Maharashtra's health department for a district-wide rollout next year"* on trial. It came back **guilty, 3 to 0**: the proposal skips the pilot the project's own readiness document requires, the triage is untested on real patients, and nobody owns it. These changes act on its conditions. Unlike the sections below, they are not split by commit.

**In the software**

- **Data notice and consent at registration (DPDP Act 2023).** OPD, a new patient on the referral form, and the Emergency screen now record the basis for processing each patient's data: the patient's consent; a parent's or guardian's for a child under 18 (named, with the relationship); or a medical emergency, recorded as pending so care never waits. The worker reads a five-point notice in Marathi, Hindi or English. The record stores the basis, notice language, notice version, worker and time, and travels with the patient record to the district service. A pending or missing consent is completed from the patient's record. A patient who declines is not registered in the app, and the screen says to treat them and record the visit on paper. The notice text is a draft for the department's legal adviser and language cell. Code: `lib/consent/dataConsent.ts`, `components/shared/DataConsentFields.tsx`, `components/shared/PatientConsentPanel.tsx`.
- **The clinician's own triage, beside the tool's.** On the OPD slip, the worker or Medical Officer who examined the patient records their RED / YELLOW / GREEN. A more urgent rating raises the patient's priority and their queue token. A less urgent one is kept for the study but never lowers anything, the same rule as the danger signs. Code: `lib/pilot/triageReview.ts`.
- **Pilot measures for the DHO.** The Data Inspector shows clinician reviews, under-triage, over-triage, RED caught, and median minutes from referral to acknowledgement and to arrival. Every figure comes from recorded data, or reads "not recorded". It also downloads a de-identified CSV (no name, ID, phone, ABHA number, village or exact age) for the study team. Code: `lib/pilot/metrics.ts`, `components/dashboard/PilotStudyPanel.tsx`.
- **Fixed: edits never reached other devices.** Devices and the relay compared copies of a patient record by its registration time, so any later change was ignored by every other device: a follow-up visit, and now a consent or a clinician's triage. Records now carry `updatedAt`, a last-changed time. Devices keep the newer copy, and the relay ignores an older copy from an offline phone and does not pass it on. The relay also stamps patients with its own clock for catch-up, as it already did for referrals. Code: `lib/sync/patientVersion.ts`, `stores/patientStore.ts`, `server/relay/app.ts`.
- **Security updates.** `body-parser` 1.20.8 → 1.20.9 (used by the relay through Express) and `zod` 4.3.6 → 4.6.7, for two new high-severity advisories that would have failed CI's audit. Only these two lockfile entries changed. The earlier critical Next.js advisory was already fixed on this branch by the upgrade to 15.5.28.
- **Tests.** New suites: `verify:consent` and `verify:pilot-metrics`. `verify:relay` now checks that an edit reaches a device catching up, and that an older copy neither replaces the newer one nor is passed on. `check:production` now records consent and the worker's triage, checks that both reach the district service and the DHO's device, and runs axe-core on the triage slip. `check:a11y` adds the patient record page, making 29 pages.

**Documents** — new folder [`docs/pilot/`](./pilot/)

- `PILOT_PROPOSAL.md`: one supervised chain instead of a district-wide rollout. It sets out the gates before the first patient, the phases, what would justify going further (set before measurement starts), who owns what, and the stopping rules.
- `VALIDATION_PROTOCOL.md`: under-triage and sensitivity for RED as primary measures, with the clinician's triage as the reference standard and its anchoring bias stated. The sample size is 139 clinician-RED patients for ±5 points. It covers the de-identified data, the analysis, safety monitoring, and every danger-sign rule listed for the clinical committee.
- `SPONSOR_AND_BUDGET_REQUEST.md`: a letter to a department sponsor and the budget lines for one chain. Amounts are left for department rates, not guessed.
- `LICENCE_GRANT_DRAFT.md`: a **draft** pilot licence from the six copyright holders to the department. It is **not in force**, and `LICENSE` is unchanged.

**Still not possible in code:** a named sponsor and budget, signatures on the licence, clinical committee and ethics approval, CDSCO's view, the CERT-In audit, government hosting, and the department's confirmation of the legal basis and notice text.

## At a glance

| | Before | After |
|---|---|---|
| Automated test suites (`npm run verify`) | 30 | **38**, all passing, one of them against a real PostgreSQL |
| Checks CI runs on every push | lint, typecheck, suites, build, two dependency audits | the same, plus **accessibility, offline and a full production-mode rehearsal in a browser**, with a PostgreSQL service |
| Production dependency audit (`npm audit --omit=dev`) | 2 critical, 2 high, 4 moderate | **0** |
| Automated accessibility (axe-core, WCAG 2.1 A/AA) | 62 low-contrast elements, unlabelled controls, tables a keyboard could not scroll | **0 violations on 28 pages** |
| Staff screens that open with no network | **0 of 11** | **11 of 11** |
| Full production rehearsal (`npm run check:production`) | did not exist | **34 of 34 steps pass** |

---

## 1. Patient safety

- **The triage result says it is decision support** (`070854a`). The OPD slip now states, in English, Hindi and Marathi, that triage ranks urgency, does not diagnose, and that the attending health worker or Medical Officer decides. Before, this was written only on the Terms page.
- **No medicine or dose suggestions** (`d081281`). The patient record had a "Required Resources" panel. It suggested medicines with doses (for example "Inj Magnesium Sulfate 50% 4g IV", "Tab Labetalol 100mg") picked by keyword from the injury field. That broke the platform's own rule that it never suggests a medicine or a dose, so the panel and the code behind it were removed.
- **No invented patient history** (`d081281`). The patient "journey" showed five made-up steps at fixed times after registration, such as "Transport assigned" at +3 minutes. It is now built only from what was recorded: registration, visits, referral events (who and when), lab orders and results (`lib/analytics/patientTimeline.ts`).
- **No invented patient descriptions** (`d081281`). The district high-risk list described patients by their first name: anyone named Ramesh "had" a diabetic foot ulcer. It now uses the patient's own visits, flags and notes (`lib/analytics/patientSummary.ts`), and "Open Record" opens that patient's record.
- **No invented dose schedule** (`070854a`). In the evaluation teleconsult example, adding a medicine without a schedule recorded "1-0-1 for 5 days", which nobody had entered. It now records "not specified".
- **No invented waiting times** (`9b88bf4`, `070854a`). The OPD screens showed fixed waits (0, 8 or 25 minutes by triage colour, "14 min" average, "~15 mins" estimate). They now show the real wait, measured from each token's own times (`lib/queue/stats.ts`), or a dash when there is nothing to measure.
- **The triage fallback is tested** (`070854a`). When the AI model cannot run (on a low-end phone, for example), rules alone decide. No test covered that path. It is now `classifyByRules()`, and all 20 clinical test cases are also run through it: every case gets the expected result, and all three decision paths are now tested.

## 2. Privacy and data protection

- **Patient records only go where they are needed** (`583b47b`). The relay used to send every patient record to every device of every facility, so a phone lost at one sub-centre held the whole district's patients. A record now goes only to:
  - the facility that registered the patient,
  - any facility on one of the patient's referrals,
  - the district officers (DHO, Super Admin).

  Another facility can no longer overwrite a patient's record. When a referral is sent, the receiving facility gets the patient's record.
- **The chatbot is protected** (`7453be3`):
  - Phone, Aadhaar and ABHA numbers and email addresses are removed from a question before it leaves the phone, and again on the server. The chat window says when something was removed.
  - Rate limits per user per minute and per day, plus a daily cap for the whole server.
  - Size limits on questions and on the background information sent with them.
  - Optional staff-only mode (`CHAT_REQUIRE_SIGN_IN`).
  - Support for a model the department hosts itself (`CHAT_BASE_URL`), so questions never leave government infrastructure. `/health` reports whether the model is self-hosted or external.
- **Who looked at which record is logged** (`9673290`, `fd1dd28`). The district service writes every request for patient records to an access log: who (from their sign-in), their role and facility, what they asked for, the result, and which records. Refused attempts are logged too. The DHO sees this log on the Audit screen.
- **Removed accounts stop working at once** (`9673290`). The district service now asks the relay whether a user is still active, moved or re-roled, instead of trusting their sign-in for 12 hours. The answer is reused for up to a minute (`NALAMMESH_RELAY_CHECK_SECONDS`, `9b46664`). A full production rehearsal confirms a deactivated MO is refused by both servers.
- **Screens lock when left alone** (`9b88bf4`). After 15 minutes without use (`NEXT_PUBLIC_SESSION_IDLE_MINUTES`), the screen locks behind a PIN prompt. Unsaved work is kept underneath. Five wrong PINs sign the user out. Reloading the page does not get past the lock.
- **Android: no backups, no screenshots** (`9b88bf4`). Google backup and phone-to-phone transfer used to copy the app's data, including patient records and staff PIN hashes. Both are now off. Patient screens can no longer appear in screenshots, screen recordings or the recent-apps preview (`FLAG_SECURE`).
- **Truthful privacy policy and consent** (`d081281`). The privacy policy said patient records were never uploaded. It now describes what really happens: referral upload to the district service, ABHA, Bhashini and the chatbot. The citizen login had three consent boxes ticked in advance and saved nowhere. They were replaced by a plain notice.
- **No third-party map tiles** (`070854a`, `9c751e8`). An unused map component loaded tiles from OpenStreetMap's servers, so the security policy allowed images from another site. The component, its stylesheet and that exception were removed. Images now load only from the app itself.
- **Server hardening** (`9673290`):
  - Requests over 2 MB are refused.
  - Responses with patient records are never stored by browsers or proxies.
  - Responses cannot be framed by other sites.
  - The API documentation can be turned off (`API_DOCS=off`).

## 3. Things that silently did not work, now fixed

- **Offline mode did not work** (`8d0d9df`). With the server stopped, 0 of 11 staff screens started. The offline cache held each page but not the code the page needs, and it did not include the ANM's home screen. Every build now writes its full file list into the service worker, so each deploy caches everything. Files that did not change are copied from the old cache, not downloaded again. Now 11 of 11 screens start offline.
- **Restarting the relay deleted every staff account** (`ae7ecaf`). The relay kept accounts and in-transit referrals in memory. It now saves them to a file (`NALAMMESH_RELAY_STORE_FILE`), written safely so a crash never leaves half a file. A production relay refuses to start without one.
- **Emergency referrals reached the hospital up to a minute late** (`52ffab2`). A referral created just after its patient waited for the next one-minute upload cycle. It now uploads immediately.
- **New phones missed referrals already on their way** (`8e9745a`). Two bugs made a device skip referrals sent before its first sign-in: the relay gave signed-out devices a timestamp they saved as "caught up", and it answered a request sent right after sign-in as if the user were still signed out. Both are fixed, and progress is now kept per user. The same problem in patient records was fixed in `583b47b`.
- **Admins could not deactivate staff** (`cd52704`). Saving a change to a user, for example unticking "Active", demanded a new PIN, because the admin's phone does not hold other staff members' PINs. Only new accounts need a PIN now.
- **Lost phones could not get their records back** (`0f36f36`). A replacement phone now offers, on the ANM dashboard and the OPD screen, to restore its facility's records from the district service. It downloads only what is missing and never overwrites what the phone already holds. Records are now also filed under the facility that registered the patient. Before, a new patient arrived with no facility at all.
- **Lab orders were not saved** (`d081281`). "Order Diagnostic Test" said "Requisition Created" but saved nothing. Orders are now saved and move through the sample → lab → result steps, and results appear in the patient's record.
- **Medicine stock used made-up quantities** (`d081281`). "Restock" added a fixed 50, "Auto-Restock All" set lines to 100, and "Emergency Supply Request" claimed to have sent a requisition. Stock now changes only by a counted quantity received (with batch and expiry) or issued, never below zero. The reorder list can be copied or downloaded as a CSV file, and the screen says the app does not send it anywhere.
- **QR wristbands could not be scanned** (`58208b8`). The "QR code" was a pattern that looked like one. It is now a real QR code holding the record id, checked by decoding it again in the tests and in a browser.
- **Demo patients could be added to a real system** (`58208b8`). "Start Demo Flow" could add made-up patients to a production device. It now works only in evaluation builds.

## 4. Screens now show only what the records say

- **OPD queue** (`9b88bf4`). Figures are computed from the tokens; previously the consulted count was inflated by 38, among other invented numbers. Calling a token records the signed-in doctor, not a demo doctor's name. The waiting-room TV shows first names and initials only, and works properly in full screen.
- **District dashboard** (`d081281`). The facility tree's bed counts, doctors, ambulances and "7 Nodes Connected" were hand-drawn. They now come from the facility records. Rates with nothing to measure show a dash, not 0%.
- **Home page** (`d081281`). Labels that claimed "live district census" or "ambulances in transit" were corrected, and "patients examined today" now counts only today.
- **Header notice** (`d081281`). It no longer says emergency obstetric care is "fully operational" at two named hospitals, permanently.
- **Free medicines page** (`d081281`). It reads the real stock instead of demo data.
- **Notifications and search wording** (`58208b8`). Notifications say "will be notified" where delivery may still be waiting for a network. The OPD search no longer claims to search Aadhaar.
- **Chatbot's description of the system** (`7453be3`). It said Next.js 14, React 18 and SIH 2025; corrected. "Open emergency dispatch" became "Open the emergency page", because the app has never dispatched vehicles.
- **District service self-description** (`b141bbe`). It said it held only anonymous summaries. It now says it holds identified records for the pre-arrival board, and how they are protected.

## 5. Security updates (dependencies)

- **Dependency upgrades** (`dfd1932`):
  - Capacitor 8.5.2 → 8.5.3, fixing a critical WebView issue.
  - Next.js 15.5.26 → 15.5.27.
  - proxy-addr, sharp and source-map-js updated.
  - Overrides for argparse, uuid and postcss-selector-parser.
  - Production audit: 0 findings.
- **Added packages:**
  - `qrcode-generator`, for real QR codes.
  - Test tools only: `jsqr`, `playwright`, `axe-core`.
- **Removed packages:** `leaflet` and its type definitions, which were unused.
- **Python:** a compiled `.pyc` file that had been committed was removed, and bytecode is now ignored (`9673290`).

## 6. Accessibility (`d6430f6`, `3f9c167`)

- Low-contrast text and badges were darkened to meet the WCAG AA ratio of 4.5:1. That was 62 elements, including 106 direct uses of the muted grey.
- Missing labels were added to the facility picker, the stock filter and search, and the OPD complaint box.
- Wide tables can be scrolled with the keyboard.
- People whose system asks for reduced motion no longer get page animations (`3f9c167`).
- `npm run check:a11y` checks 28 pages, signed in as each role, and CI runs it. Automated checks catch only about a third of problems, so a manual audit is still needed.

## 7. Running it in production

- **Production mode, end to end** (`9b46664`). `npm run check:production` builds the app in production mode, starts the relay and the district service, and drives a district's first day in a real browser:
  1. The admin creates staff.
  2. An ANM on a new phone registers an emergency patient; the referral goes to the PHC.
  3. The MO sees the patient on the pre-arrival board.
  4. The DHO sees the access log.
  5. A deactivated MO is refused by both servers.
  6. The relay restarts and keeps every account.
  7. A replacement phone restores a record.

  CI runs it on every push. While being built, it found three of the bugs in section 3: the admin PIN problem, the late emergency referral and the missed referrals.
- **PostgreSQL** (`9673290`). The district service runs on PostgreSQL with `backend/requirements-postgres.txt`, and `npm run verify:postgres` tests it against a real database. SQLite remains the default for a single machine.
- **Safe relay storage** (`ae7ecaf`). See section 3.
- **Configuration documented** (`ae7ecaf`, `c9a8169`). Every setting is explained in the two `.env.example` files, and the production setup steps are in `PRODUCTION_READINESS.md`.

## 8. Documentation

- **New: [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md)** (`c9a8169`, updated since). It covers:
  - what the software enforces and which test proves each item;
  - the 13 steps that only the department or the team can take, with owners;
  - known limitations;
  - production setup, step by step.
- **README.md** brought up to date (`c9a8169` and later). It no longer says the record store is unauthenticated, and it documents the new settings, offline behaviour, security, the chatbot's protections, every test, and every screen.
- **backend/README.md** rewritten (`c9a8169`). It wrongly said facilities send only anonymous summaries. It now covers who may call each route, the protections and how to deploy.
- **Handover PDF** rebuilt from `docs/handover-build.py` (`c9a8169` and later). Stale facts were corrected: Next.js 15 not 14, real servers exist, database version 6, the current roles and audit access, three triage paths, the current tests, and honest gaps.
- **SIH_PROJECT_CONTEXT.md** is marked as the hackathon proposal, with "As built" notes wherever the software differs (`c9a8169`). For example, there is no e-prescription, ambulance dispatch or video call, and the indicators are computed instead of fixed numbers.
- **This file** (`docs/CHANGES.md`).

## 9. New tests and checks

| Command | What it proves | Commit |
|---|---|---|
| `verify:chat-redaction` | the phone removes phone, Aadhaar and ABHA numbers before asking the chatbot | `7453be3` |
| `verify:chat-guard` | the server removes them again, applies rate limits and staff-only mode | `7453be3` |
| `verify:session-lock` | idle screens lock and unlock only with the PIN; queue figures are real | `9b88bf4` |
| `verify:stock` | stock changes only by counted receipts and issues | `d081281` |
| `verify:qr` | wristband QR codes decode to the patient's id | `58208b8` |
| `verify:backend-hardening` | access log, size limit, no caching, docs switch, revocation | `9673290` |
| `verify:postgres` | the district service works on a real PostgreSQL | `9673290` |
| `verify:service-worker` | every role's screens and build files are cached for offline use | `8d0d9df` |
| `check:a11y` | 28 pages pass automated WCAG 2.1 A/AA checks | `d6430f6` |
| `check:offline` | the ANM's screens open with the server stopped | `8d0d9df` |
| `check:production` | the whole system in production mode, in a browser (34 steps) | `9b46664`, `0f36f36` |

Existing suites were extended:
- `verify:relay`: real restarts, the store file, catch-up after sign-in, patient record scoping.
- `verify:outbox`: a record queued during an upload goes up at once.
- `verify:cloud-records`: the access log, and restoring a replacement phone.
- `verify:access-api`: the restore endpoint is limited to the user's own facility.
- `verify:triage`: the rules-only path.
- `verify:csp`: no images from other sites.
- `verify:metrics`: the patient timeline and summary.
- `verify:production-mode`: the demo flow adds nobody.
- `verify:chat-provider`: the self-hosted model.

## 10. New settings

App build and relay (`.env.example`):

| Setting | Purpose |
|---|---|
| `NEXT_PUBLIC_DEPLOYMENT_MODE` | `production` builds without demo data or demo accounts |
| `NEXT_PUBLIC_SESSION_IDLE_MINUTES` | minutes before an idle screen locks (default 15) |
| `NALAMMESH_DEPLOYMENT_MODE` | `production` relay: no demo accounts |
| `NALAMMESH_BOOTSTRAP_ADMIN_PIN` / `_NAME` | the first Super Admin's PIN, used only while none exists |
| `NALAMMESH_RELAY_STORE_FILE` | where the relay keeps accounts and referrals (required in production unless Upstash is used) |

District service (`backend/.env.example`):

| Setting | Purpose |
|---|---|
| `NALAMMESH_AUTH_SECRET` | the same signing secret as the relay |
| `NALAMMESH_RELAY_URL`, `NALAMMESH_RELAY_CHECK`, `NALAMMESH_RELAY_CHECK_SECONDS` | ask the relay whether a user is still active; strict mode; how long the answer is reused |
| `API_DOCS` | `off` hides the API documentation |
| `MAX_REQUEST_BYTES` | largest request accepted (default 2 MB) |
| `CHAT_BASE_URL`, `CHAT_MODEL`, `CHAT_API_KEY` | a chatbot model the department hosts |
| `CHAT_RATE_PER_MINUTE`, `CHAT_RATE_PER_DAY`, `CHAT_GLOBAL_PER_DAY` | chatbot rate limits |
| `CHAT_REQUIRE_SIGN_IN` | chatbot for signed-in staff only |
| `CHAT_CLIENT_IP_HEADER` | the header a trusted proxy sets with the caller's address |
| `CHAT_MAX_CONTEXT_CHARS` | largest background text accepted with a question |

## 11. Files added and removed

**Added:**
- Patient safety and data:
  - `lib/analytics/patientTimeline.ts`
  - `lib/analytics/patientSummary.ts`
  - `lib/queue/stats.ts`
  - `lib/stock/movement.ts`
  - `lib/qr.ts`
  - `components/dashboard/FacilityTree.tsx`
- Privacy and security:
  - `lib/chat/redact.ts`
  - `backend/app/chat_guard.py`
  - `backend/app/hardening.py`
  - `lib/auth/idleLock.ts`
  - `components/auth/SessionLock.tsx`
  - `android/app/src/main/res/xml/data_extraction_rules.xml`
- Reliability:
  - `scripts/stamp-service-worker.mjs`
  - `lib/sync/restore.ts`
  - `components/shared/RestoreRecords.tsx`
- Production:
  - `backend/requirements-postgres.txt`
  - `docs/PRODUCTION_READINESS.md`
  - `docs/CHANGES.md`
- Tests:
  - `scripts/check-a11y.mjs`
  - `scripts/check-offline.mjs`
  - `scripts/check-production-flow.mjs`
  - `scripts/verify-chat-redaction.mts`
  - `scripts/verify-qr.mts`
  - `scripts/verify-service-worker.mts`
  - `scripts/verify-session-lock.mts`
  - `scripts/verify-stock.mts`
  - `scripts/fixtures/redaction-cases.json`
  - `backend/scripts/verify_chat_guard.py`
  - `backend/scripts/verify_hardening.py`
  - `backend/scripts/verify_postgres.py`

**Removed:**
- `components/dashboard/LiveMap.tsx`: unused, and it loaded third-party map tiles.
- `backend/api/__pycache__/index.cpython-314.pyc`: a compiled file that should never have been committed.

## 12. Not changed, and still to do

- **Licence:** unchanged. It still reserves all rights, so a government department cannot legally use the software until the team grants permission.
- **Not possible in code**, owned by the department or the team:
  - clinical validation of triage, whose model was trained on synthetic data;
  - CDSCO's view on whether triage is a medical device;
  - a CERT-In-empanelled security audit;
  - State Data Centre or MeitY-empanelled hosting;
  - DPDP Act decisions (the app records per-patient notice and consent since the 26 October update; the department confirms the legal basis and notice text);
  - ABDM certification (ABHA works only in the sandbox);
  - translation of the English-only staff screens;
  - device management for lost phones;
  - a supervised pilot.

  Each is described in [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md).
- **Known limitations of the software:**
  - Records still waiting in a lost phone's upload queue are lost with it.
  - Queue, stock and appointment entries are not restored to a replacement phone.
  - The district service's anonymous reporting endpoints are not yet fed by the app.
  - There is no audio or video consultation, by design.
  - There is no ambulance dispatch.

---

## Appendix: all commits, oldest first

| Commit | Change |
|---|---|
| `dfd1932` | Dependencies: clear the critical Capacitor and proxy-addr advisories |
| `7453be3` | Cloud assistant: size caps, rate limits, identifier redaction, staff-only mode |
| `9b88bf4` | Lock idle sessions; real queue figures; no backups or screenshots on Android |
| `d081281` | Screens state what the records say: no invented figures, events or doses |
| `58208b8` | Real QR wristbands; no demo patients in production; honest notifications |
| `9673290` | District service: access log, revocation, body limit, no-store, PostgreSQL |
| `d6430f6` | Accessibility: zero axe-core WCAG 2.1 A/AA violations on 28 pages, checked in CI |
| `fd1dd28` | Audit screen shows the district service's access log |
| `8d0d9df` | Offline: pre-cache each build's own files, so screens work with no signal |
| `ae7ecaf` | Relay keeps staff accounts and referrals across restarts |
| `070854a` | Triage slip says it is decision support; no invented waits or dose schedules |
| `c9a8169` | Docs: production readiness checklist; README, backend and handover brought up to date |
| `9c751e8` | Remove the unused map's stylesheet, packages and third-party tile allowance |
| `cd52704` | Admin can deactivate or re-post staff without resetting their PIN |
| `b141bbe` | District service describes itself accurately |
| `52ffab2` | Emergency referral uploads at once, not after the minute sweep |
| `8e9745a` | A device's first sign-in catches up on referrals already on their way |
| `3f9c167` | Pages appear without animation for users who ask for reduced motion |
| `9b46664` | check:production: the whole system in production mode, in a browser, in CI |
| `583b47b` | Patient records reach only the facilities that need them |
| `0f36f36` | A replacement phone restores its facility's records from the district service |
