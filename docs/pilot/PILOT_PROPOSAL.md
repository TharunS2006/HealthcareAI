# NalamMesh — proposal for a supervised one-chain pilot

*Draft for the team to put to the Public Health Department, October 2026. It replaces any proposal to roll NalamMesh out district-wide: expansion is a separate decision, taken only on this pilot's results.*

Companion documents in this folder:

| Document | What it is |
|---|---|
| [`VALIDATION_PROTOCOL.md`](./VALIDATION_PROTOCOL.md) | How the pilot measures triage safety and referral times, for the clinical committee and the ethics committee |
| [`SPONSOR_AND_BUDGET_REQUEST.md`](./SPONSOR_AND_BUDGET_REQUEST.md) | The request to a named department sponsor, with the budget lines to price |
| [`LICENCE_GRANT_DRAFT.md`](./LICENCE_GRANT_DRAFT.md) | A draft licence from the team to the department for the pilot — **not in force until signed** |

## 1. What we are asking for

Permission and support to use NalamMesh as **decision support** on **one referral chain**: one Sub-Centre, the PHC it refers to, the CHC above that and the District Hospital at the top. It runs for a fixed period beside the existing paper registers, so that the pilot measures two things on real patients:

1. **Is the triage safe enough?** How often NalamMesh rates a patient less urgent than the examining clinician does (under-triage), and how many of the clinician's RED patients it also rates RED.
2. **Do referrals get there better?** How long a referral takes to be acknowledged, and for the patient to arrive, and how many emergencies have to be escalated.

We are **not** asking for a district-wide rollout. Whether NalamMesh goes further is decided after the pilot, by the department, on the results.

## 2. Why one chain first

An independent review of the earlier proposal (a district-wide rollout next year) found it premature, for reasons the team accepts:

- The project's own readiness document says the software is *ready for a supervised pilot but not cleared for real patients* (`docs/PRODUCTION_READINESS.md`).
- The triage model has only ever seen synthetic data. Its thresholds have not been reviewed by a clinical committee, and it has not been validated on real patients.
- Nobody owned it: there was no sponsor, budget, operator or licence.

A pilot on one chain answers the first two with real numbers and settles the third before anything grows.

## 3. The chain

Chosen by the department. We suggest a chain where the problem is sharpest: a Sub-Centre with poor mobile coverage, its PHC, the CHC that is its first referral unit, and their District Hospital. All four must agree to take part. The facility names in the public demo are fictional and are not a proposal.

## 4. What the software already does for the pilot

Every item below is checked automatically on every change (`.github/workflows/ci.yml`).

| Need | In place | Checked by |
|---|---|---|
| Patient's data notice and consent (DPDP Act 2023) | Every new registration records the basis — the patient's consent, a parent's or guardian's for a child, or a medical emergency with consent taken later — and the notice language, version, worker and time. The notice is in Marathi, Hindi and English. A pending emergency consent is completed from the patient's record. | `verify:consent`, `check:production` |
| The clinician's own triage | On the triage slip, the worker or Medical Officer who examined the patient records their own RED / YELLOW / GREEN beside the tool's. A more urgent rating raises the patient's priority; a less urgent one never lowers it. | `verify:pilot-metrics`, `check:production` |
| The pilot's measures | The District Health Officer's Data Inspector shows under-triage, over-triage, RED caught and median referral times, and downloads a de-identified CSV for the study team. | `verify:pilot-metrics`, `check:production` |
| Records reach the next facility | Offline-first records, a durable upload outbox, the Pre-Arrival Board, escalation to the DHO after 10 minutes unacknowledged; edits made after registration reach every device that holds the record. | `check:production`, `verify:relay`, `verify:outbox` |
| Access is controlled and logged | PIN sign-in, roles and postings on every route, records only on the devices that need them, an access log the DHO reads | `verify:permissions`, `verify:access-api`, `verify:backend-hardening` |
| Works with no network | The installed app opens every ANM screen offline | `check:offline` |

## 5. Gates before the first real patient

The pilot does not start until each of these is done. Owners are proposed; the department confirms them.

| # | Gate | Owner |
|---|---|---|
| 1 | Licence to the department signed by the copyright holders (draft: `LICENCE_GRANT_DRAFT.md`) | The team |
| 2 | Named department sponsor and an approved budget (`SPONSOR_AND_BUDGET_REQUEST.md`) | Department |
| 3 | Clinical committee reviews every danger-sign rule and threshold, and the validation protocol | Department, clinicians |
| 4 | Institutional ethics committee approval of the protocol, including how research use of the data is consented or waived | Department, study team |
| 5 | CDSCO asked how it classifies the triage function (it may be a medical device under the Medical Devices Rules, 2017) | Department |
| 6 | Security audit by a CERT-In-empanelled auditor, findings fixed and re-tested | Department, the team |
| 7 | Government hosting (State Data Centre or MeitY-empanelled cloud), TLS, PostgreSQL with tested backups | Department |
| 8 | The data notice text approved by the department's legal adviser and language cell; the legal basis for processing confirmed | Department |
| 9 | Facility devices under mobile device management; staff trained; a paper fallback agreed | Department, the team |

## 6. Phases

Durations are estimates; the sample size in the validation protocol decides how long measurement runs.

| Phase | What happens | Ends when |
|---|---|---|
| 0. Preparation | The gates above | Every gate is closed |
| 1. Run-in (about 4 weeks) | Staff use the app beside paper. The study team checks that reviews and consents are being recorded and counts RED cases per week, to set the measurement period. | Recording is complete and the weekly RED count is known |
| 2. Measurement | Normal use. Weekly safety review of every under-triaged case by the clinical lead. | The protocol's sample size is reached, or a stopping rule applies |
| 3. Analysis and report | The study team analyses the de-identified export and reports to the department and the committees | The report is accepted |

## 7. What would justify going further

Set by the clinical committee **before** measurement starts, so the result cannot move the goalposts. The team proposes:

- **Safety:** the lower bound of the 95% confidence interval for sensitivity for RED is at or above a threshold the committee sets (we suggest 0.85), and no serious harm is judged attributable to under-triage.
- **Completeness:** a clinician's triage is recorded for at least 90% of patients triaged, and consent (not pending) for at least 95% of non-emergency registrations.
- **Referrals:** referral-to-acknowledgement and referral-to-arrival times are reported with their spread. Paper registers rarely record these times, so if no baseline can be measured during the run-in, the times are reported descriptively rather than claimed as an improvement.

## 8. Who owns what

| Role | Who | Responsible for |
|---|---|---|
| Sponsor | *(to be named by the department)* | Accountable for the pilot; approves budget and scope |
| District nodal officer | The District Health Officer or a deputy | Day-to-day operation, escalations, the access log |
| Clinical lead | A Medical Officer named by the department | Weekly safety review, stopping decisions, the clinical committee's link |
| Technical owner | The NalamMesh team, under the signed licence | Fixes, releases, support to the operations lead; handover to the department's IT or NIC at the end |
| Operations lead / helpdesk | A person funded in the budget | Devices, accounts, first-line support, backups and monitoring |
| Data protection | The department's designated officer | Notice, consent, rights requests, incidents (CERT-In expects cyber incidents reported within 6 hours) |

## 9. Safety during the pilot

- Triage is decision support. The slip says so, and the clinician decides.
- The danger-sign rules and the clinician's own rating can only raise urgency, never lower it.
- An emergency referral nobody acknowledges within 10 minutes is escalated to the DHO.
- When the network or a server is down, care continues on the device and on paper, and referring facilities phone ahead (108 / 102 for transport, as now).
- **Stopping rules:** any serious harm plausibly linked to under-triage is reviewed by the clinical lead within a day, who may pause triage use at once. The committee may stop the pilot at any review.
