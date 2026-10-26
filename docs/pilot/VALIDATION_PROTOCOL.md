# NalamMesh — validation protocol for the supervised pilot

*Draft for review by the department's clinical committee and an institutional ethics committee, October 2026. Nothing here is final until both have approved it. Goes with [`PILOT_PROPOSAL.md`](./PILOT_PROPOSAL.md).*

## 1. Question

On real patients in one referral chain (Sub-Centre → PHC → CHC → District Hospital), used as decision support:

1. **Primary (safety).** How often does NalamMesh rate a patient less urgent than the examining clinician does, and what share of the patients the clinician rates RED does it also rate RED?
2. **Secondary.** Over-triage; overall agreement; how long referrals take to be acknowledged and for the patient to arrive; how often emergencies are escalated; completeness of the data notice and consent.

## 2. Design

A prospective observational study. NalamMesh is used as it would be in service. For every triage, the worker or Medical Officer who examined the patient records their own acuity on the triage slip (the app's "Your triage (pilot study)" step), and that is the **reference standard**. Care follows the clinician's decision throughout; the app only ever raises urgency.

**Known bias, stated up front.** The clinician sees the tool's result before recording their own, so their rating may lean towards it (anchoring), which would make agreement look better than it is. Mitigation, for the committee to choose:

- (a) In a random sub-sample, for example one day a week, the clinician writes their acuity on paper before viewing the slip, and the two are compared.
- (b) A second clinician later reviews the recorded vitals and complaint for every under- or over-triaged case and a random sample of agreed ones.

## 3. Setting and participants

- **Facilities:** the four facilities of the chain the department names.
- **Patients:** every patient triaged on NalamMesh at those facilities during the measurement phase whose data may be processed: their own consent, a guardian's for a child, or a medical emergency with consent completed later (the app records which).
- **Excluded from analysis:** patients who decline (they are treated and recorded on paper, as the app instructs), and triages with no clinician rating recorded. The number of each is reported.

## 4. Outcomes and definitions

| Measure | Definition | Source (app export column) |
|---|---|---|
| Under-triage (primary) | Tool's acuity lower than the clinician's (GREEN < YELLOW < RED) | `agreement = UNDER` |
| Sensitivity for RED (primary) | Of reviews the clinician rated RED, the share the tool rated RED | `clinician_status`, `tool_status` |
| Over-triage | Tool's acuity higher than the clinician's | `agreement = OVER` |
| Agreement | Exact agreement; weighted Cohen's kappa on the 3×3 table | `tool_status`, `clinician_status` |
| Specificity for RED | Of reviews the clinician did not rate RED, the share the tool did not rate RED | same |
| Referral to acknowledgement | Minutes from the referral being raised to its acknowledgement by the receiving facility | `minutes_to_acknowledge` |
| Referral to arrival | Minutes from referral to arrival recorded at the receiving facility | `minutes_to_arrival` |
| Escalations | Emergency referrals escalated to the DHO for being unacknowledged | `escalated` |
| Consent completeness | Non-emergency registrations with consent recorded (not pending) | patient record `dataConsent` |

Subgroups: pregnant women (`pregnant`), children (`age_band` 0-4 and 5-17), and how the tool decided (`tool_decision_source`: model, danger-sign override, or rules alone).

## 5. Sample size

The study is sized to estimate sensitivity for RED with a 95% confidence interval of about ±5 percentage points:

n = z² × p × (1 − p) ÷ d², with z = 1.96, an assumed sensitivity p = 0.90 and half-width d = 0.05, gives **n = 139 patients rated RED by the clinician**.

How many triages that takes depends on how many patients are RED, which nobody has measured in this chain. The run-in counts it. For example, **if** 10% of triaged patients were RED, about 1,390 reviewed triages would be needed. The measurement phase runs until 139 clinician-RED reviews are recorded, or until a time limit the committee sets. If the time limit comes first, the achieved precision is reported.

## 6. Data

- **Collection:** in the app, as part of care: the triage, the clinician's rating, the referral's status times and the consent record. The study adds no extra forms, except the paper sub-sample in mitigation (a), if chosen.
- **Extraction:** the District Health Officer's Data Inspector, *Download de-identified CSV*. One row per clinician review, with no name, ID, phone, ABHA number, village or exact age, and the referral raised for that triage linked by time (within 24 hours). Columns: `case_no, review_date, facility_id, age_band, sex, pregnant, tool_status, tool_decision_source, clinician_status, agreement, reviewer_role, referred, referral_priority, minutes_to_acknowledge, minutes_to_arrival, admitted, escalated`.
- **Handling:** the export can still identify a patient in a small facility, so it is personal data. It is kept on department systems, shared only with the study team named in the ethics approval, and deleted at the end of the study according to the department's retention rules.
- **Research use and consent:** the in-app notice covers using the data for care and for reports that do not name the patient. Whether research use needs separate consent or a waiver is for the ethics committee to decide. This protocol does not assume either.

## 7. Analysis

- Proportions (under-triage, over-triage, sensitivity, specificity) with Wilson 95% confidence intervals; weighted kappa with its 95% CI.
- Referral times as medians with interquartile ranges. A time recorded before the referral itself (a device clock error) is excluded, and the number excluded is reported.
- Subgroup results as above, reported descriptively; the study is not powered for subgroup comparisons.
- Missing data are reported, not imputed.

## 8. Safety monitoring

- The clinical lead reviews every under-triaged case each week, with the vitals and outcome, and reports to the committee.
- Any serious harm plausibly linked to under-triage is reviewed within a day. The clinical lead may pause the use of triage at once, and the committee may stop the study.
- The app's own safeguards stay on throughout: the danger-sign rules and the clinician's rating only raise urgency, the slip states that it is decision support, and an unacknowledged emergency referral escalates to the DHO after 10 minutes.

## 9. Before the study starts

1. The clinical committee reviews **every danger-sign rule and threshold** (appendix) and may change them. Any change is made in the code, tested (`npm run verify:triage`) and released before measurement starts. The study then uses that version only.
2. The ethics committee approves this protocol.
3. The other gates in `PILOT_PROPOSAL.md` §5 are closed.

## Appendix — the danger-sign rules the committee reviews

From `assessClinically()` in `lib/triage/model.ts`. RED-level flags make the result RED whatever the model says; caution flags inform the model. Units as recorded on the form.

| Flag | Rule | Level |
|---|---|---|
| SPO2_CRITICAL | SpO₂ below 90% | RED |
| SPO2_LOW | SpO₂ 90–94% | caution |
| TACHYCARDIA_SEVERE | Pulse above 130/min | RED |
| BRADYCARDIA_SEVERE | Pulse below 48/min | RED |
| TACHYCARDIA | Pulse 106–130/min | caution |
| HYPOTENSION_SHOCK | Systolic 85 mmHg or lower | RED |
| HYPERTENSION_SEVERE | Systolic 160+ or diastolic 100+ mmHg | RED |
| HYPERTENSION | Systolic 140+ or diastolic 90+ mmHg | caution |
| RESP_RATE_CRITICAL | Respiratory rate 36/min or more | RED |
| RESP_RATE_LOW | Respiratory rate 8/min or fewer | RED |
| RESP_RATE_HIGH | Respiratory rate 27–35/min | caution |
| HIGH_FEVER | Temperature 102.5 °F or more | caution |
| HYPOGLYCEMIA_CRITICAL | Blood glucose 55 mg/dL or lower | RED |
| HYPERGLYCEMIA_CRITICAL | Blood glucose 280 mg/dL or more | RED |
| HYPERGLYCEMIA | Blood glucose 180–279 mg/dL | caution |
| HIGH_RISK_MATERNAL | Pregnant, with systolic 150+ or diastolic 95+ mmHg, or "headache", "bleeding" or "eclampsia" in the complaint | RED |
| HIGH_RISK_PEDIATRIC | Child aged 60 months or under, with respiratory rate 40+, SpO₂ below 92%, temperature above 102 °F, or "malnutrition" or "unconscious" in the complaint | RED |
| CONSCIOUSNESS_CRITICAL | AVPU: responds to pain only, or unresponsive | RED |
| CONSCIOUSNESS_ALTERED | AVPU: responds to voice only | caution |

**Also for the committee:**
- When a reading is not taken, the rules use a healthy-adult value in its place: SpO₂ 96%, pulse 80, BP 120/80, temperature 98.6 °F, glucose 100 mg/dL, respiratory rate 16. A missing reading therefore never raises a flag. The OPD form requires some readings and lets others be marked not measured (`lib/triage/intake.ts`), so the committee should decide which readings must be mandatory.
- The complaint keywords are matched in English only.
