# SIH26128 – PashuRaksha: document pack (proposal stage)

Problem: efficient systems for early detection, prevention and management of livestock diseases and animal health issues.
Status: proposal only. Nothing described here has been built, benchmarked or validated. Items marked VERIFY need an official source before submission.

## 1. Requirement matrix (PS phrase → field failure → capability → evidence)

| PS phrase | What goes wrong in the field | Capability | Evidence to collect |
|---|---|---|---|
| Symptoms reported late | Home remedies first; fear of movement restrictions; no feedback to the reporter | 4-tap offline app, missed-call IVR, assisted / anonymous reports, feedback within a set time | Report-to-response time |
| Diagnostic facilities distant | Sample not taken, spoils, result never returns | Sample checklist, nearest-lab suggestion, tracked status, result returned | Share of suspect cases with sample sent; lab turnaround |
| Histories incomplete | Paper registers; nobody knows who is overdue | Herd record, animal level where an ear tag exists, due-lists | Due-list coverage; record completeness |
| Information fragmented | Dispensary, lab, drives, surveillance separate | One case record every actor writes to | Records linked per case |
| No unified real-time view at village / block / district | Officer sees totals, not village patterns | Same data rolled up at three levels; cluster rules | Time from first cluster to alert |
| Delay in containment | Unanswered reports sit with one person | Escalation timer to next officer | Escalation acknowledgement time |
| Zoonotic transmission | Human health told late | Zoonotic flag with alert path | Time to human-health notice |
| Low-connectivity areas | Online-only tools fail | Offline-first app with sync outbox; SMS / IVR fallback | Sync success rate |

## 2. Workflow

Report (app / IVR / assisted) → intake and identity (village code, herd / ear tag) → syndrome triage (routine advice / vet visit / suspected notifiable) → cluster check across villages and weeks → alert and escalation timer → sample and lab referral → officer response → containment → close, with feedback to the reporter.

Each case carries timestamps: first symptom, reported, triaged, sample sent, lab result, officer response, contained, closed. The headline measure is hours from first report to action, per block (the "outbreak clock").

## 3. Decision layers

1. Rules decide: syndromes, thresholds, escalation, missing-data checks. Deterministic and auditable.
2. ML assists: anomaly detection and risk ranking where history exists. Labelled assistive; never the trigger for escalation on its own.
3. Veterinarian decides: diagnosis, treatment, containment. The system does not prescribe drugs.

Every flag shows its reason (signs reported, nearby cases, recent mortality, vaccination gap, trend) and a confidence note.

## 4. Illustrative syndrome rules (VERIFY with veterinarians and official case definitions)

| Syndrome flag | Illustrative signs | Notes |
|---|---|---|
| FMD-like | fever, mouth / tongue / foot lesions, drooling, lameness | cloven-hoofed species |
| Lumpy skin disease-like | fever, skin nodules, swollen lymph nodes | cattle, buffalo |
| Haemorrhagic septicaemia-like | fever, throat / neck swelling, breathing difficulty, sudden death | cattle, buffalo; seasonal |
| PPR-like | fever, eye / nose discharge, mouth sores, diarrhoea | goat, sheep |
| Anthrax-like (zoonotic) | sudden death, bleeding from orifices | zoonotic flag; advise not to open the carcass |
| Avian influenza-like (zoonotic) | sudden high poultry mortality, swollen head | zoonotic flag |
| Rabies-like (zoonotic) | aggression or paralysis, drooling, bite history | zoonotic flag |

## 5. Cluster rules (starting values, to be tuned with officers)

- 3 or more similar syndrome reports in 2 or more villages of one block within 7 days → block alert.
- Unusual mortality count for a village or block → alert.
- Zoonotic-flag syndrome → immediate notice to the officer and human-health contact.
- Baseline: counts-based aberration detection per block once history exists; space-time cluster scan as a later upgrade. With no history the system states this and relies on the rules.

## 6. Architecture

Channels (para-vet / vet offline app, farmer IVR / SMS, lab and drive data) → case intake with sync outbox and identity → engines (syndrome rules, cluster rules and baseline, weather and history risk layer) → workflows (escalation timer, lab referral tracker, vaccination due-lists, One Health alert) → outputs (multilingual alerts, officer dashboard with outbreak clock, village map and coverage).

Proposed stack: Next.js PWA with Capacitor Android and IndexedDB, FastAPI or Node relay, PostgreSQL with PostGIS, an IVR provider, Bhashini for language, MapLibre for the map. Reuses the offline-first and escalation pattern of NalamMesh.

## 7. Validation plan (no results claimed)

1. Historical replay of past outbreak reports through the rules: would an alert have fired, and when.
2. Veterinary expert review of rules and thresholds.
3. One-block pilot measuring the process measures below.
4. Temporal and geographic holdout once enough data exists.

Proposed measures: report-to-response time; share of suspect cases with a sample sent; escalation acknowledgement time; due-list coverage; false-alarm rate; record completeness.

## 8. Risks

| Risk | Handling |
|---|---|
| Under-reporting from fear of restrictions | Assisted and anonymous reports; feedback to reporter |
| False alarms | Alert levels, thresholds, officer review before a district alert |
| Thin baseline data | Rules first; baseline learned; confidence stated |
| Low digital literacy | Pictures, voice, IVR; para-vet enters data |
| Data privacy | Role-based access; aggregated for planning |
| Overclaiming AI | Assistive, labelled; rules and officers decide |

## 9. Likely evaluator questions

- How do you avoid false alarms? Thresholds, alert levels, officer review.
- What if farmers do not report? IVR, assisted and anonymous reports, feedback.
- Is this AI? Rules first, assistive ML second, nothing claimed as diagnosis.
- Offline? Local queue and sync, SMS / IVR fallback.
- Does it duplicate national systems? No. It links to them and adds the outbreak clock and the referral loop.

## 10. To verify before submitting

- Current notifiable-disease list and case definitions (Animal Husbandry Department, WOAH).
- What national systems (animal ID, livestock mission, NADCP data) actually expose; present as an integration path until confirmed.
- Reference details on slide 6; Team ID and name (the deck reuses 178601 / TechDevs_6 from the other submissions).
- The name PashuRaksha is a placeholder.
