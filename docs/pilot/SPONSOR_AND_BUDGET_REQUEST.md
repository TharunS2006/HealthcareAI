# NalamMesh — request to a department sponsor, with the pilot budget

*Draft for the team to send, October 2026. Bracketed fields are for the team or the department to fill in. No amounts are given: they must come from the department's own rates and quotations, not from guesses.*

---

**To:** [Name], [Designation — for example Joint Director of Health Services, or the District Health Officer, [District]]
**From:** Team TechDevs_6, R. M. K. College of Engineering and Technology — NalamMesh
**Subject:** Request to sponsor a supervised one-chain pilot of NalamMesh

Respected Sir / Madam,

NalamMesh is an offline-first app for rural public health. It records patients on the health worker's phone with no network, gives decision-support triage, and sends each referral and the patient's record ahead to the receiving facility, escalating an unanswered emergency to the District Health Officer after 10 minutes.

We are not asking for a district-wide rollout. We ask the department to:

1. **Name a sponsor** accountable for a supervised pilot on **one referral chain**: one Sub-Centre, its PHC, its CHC and the District Hospital they refer to, chosen by the department.
2. **Approve the budget** below for that chain.
3. **Start the approvals** only the department can obtain: clinical committee review of the triage rules, ethics committee approval of the validation protocol, CDSCO's view on the triage function, a CERT-In-empanelled security audit, and government hosting.

The pilot measures, on real patients, how safe the triage is and whether referrals are acknowledged and prepared faster. Whether NalamMesh goes any further is then the department's decision, on those results. The proposal, the validation protocol and a draft licence to the department are attached.

Yours faithfully,
[Names of the team members signing]
[Contact]

Enclosures: `PILOT_PROPOSAL.md`, `VALIDATION_PROTOCOL.md`, `LICENCE_GRANT_DRAFT.md`

---

## Budget for one chain

Quantities are worked out from the chain the department chooses. Amounts are filled in from department rates or quotations.

| # | Item | Quantity basis | Quantity | Amount (₹) |
|---|---|---|---|---|
| 1 | Android phones or tablets for staff without a suitable facility device | One per worker on duty at a time who lacks one, across the 4 facilities, plus 1 spare per facility | [ ] | [ ] |
| 2 | Mobile device management licences (encryption, screen lock, remote wipe, controlled updates) | One per device in item 1 and per existing device used | [ ] | [ ] |
| 3 | Mobile data for the devices | Per device per month, for the pilot's duration | [ ] | [ ] |
| 4 | Hosting: the relay and the district record service in a State Data Centre or MeitY-empanelled cloud, with TLS | Two small servers (or one, if sized for both), for the pilot's duration | [ ] | [ ] |
| 5 | PostgreSQL on encrypted storage, with backups and restore drills | For the pilot's duration | [ ] | [ ] |
| 6 | Security audit by a CERT-In-empanelled auditor, and a re-test after fixes | One audit and one re-test (application, API, Android build and hosting) | [ ] | [ ] |
| 7 | Training: ANMs, Medical Officers, hospital staff and the DHO's office | Sessions per facility, plus a refresher after the run-in | [ ] | [ ] |
| 8 | Operations lead and helpdesk (accounts, devices, first-line support, monitoring) | One person, part- or full-time, for the pilot's duration | [ ] | [ ] |
| 9 | Language review of the data notice and the English-only screens (department language cell or Bhashini, with a clinician reviewing clinical terms) | One review, plus revisions | [ ] | [ ] |
| 10 | Clinical committee and clinical lead time (rule review, weekly safety review) | As the department's norms provide | [ ] | [ ] |
| 11 | Ethics committee fees, if any | As charged | [ ] | [ ] |
| 12 | Study analysis and report | Study team time | [ ] | [ ] |
| 13 | Contingency | A share of the total the department sets | [ ] | [ ] |
| | **Total** | | | **[ ]** |

**Not charged:** the software itself, under the licence in `LICENCE_GRANT_DRAFT.md` once signed, and the team's development and support time for the pilot unless the department decides otherwise.
