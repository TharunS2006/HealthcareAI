# NalamMesh — SIH 2025 Project Context Document
## Problem Statement ID: 26133

---

### 1. Project Overview & Meta Information
- **Project Name:** NalamMesh (नलममेश)
- **Tagline:** Integrated Digital Care-Access and Quality Support Platform for Rural Public Healthcare
- **Problem Statement ID:** 26133
- **Problem Statement Title:** Accessibility and quality of public healthcare services, particularly in rural and underserved areas
- **Target Organization / Ministry:** Government of Maharashtra (Maharashtra State Innovation Society / Department of Skills, Employment, Entrepreneurship & Innovation)
- **Theme:** MedTech / BioTech / HealthTech
- **Target Deployment Region:** Gadchiroli District & Tribal/Underserved Belts of Maharashtra (e.g., Nandurbar, Melghat, Palghar)

---

### 2. Problem Statement Analysis & Ground Reality
In rural and tribal public health systems (like Gadchiroli, Maharashtra):
1. **Severe Geographic & Specialist Access Barriers:** Patients travel 40–80 km across forested terrains from Sub-Centres to District Hospitals with delayed referrals and zero continuity of clinical history.
2. **Fragmented Longitudinal Records:** Patients move between Sub-Centres (SC), Primary Health Centres (PHC), Community Health Centres (CHC), Sub-District Hospitals (SDH), and District Hospitals (DH) with handwritten paper slips that are lost or illegible.
3. **Zero / Intermittent Connectivity (Digital Divide):** Over 60% of tribal sub-centres operate in 2G or zero-cellular blackouts, rendering traditional cloud-only telemedicine portals useless.
4. **Delayed Triage & Maternal/Pediatric Mortality:** Frontline Health Workers (ASHA/ANM/CHO) lack real-time decision support to triage severe preeclampsia, pediatric malnutrition (SAM), infectious fever, or diabetic ulcers before it's too late.
5. **Medicine Stockouts & Diagnostic Blind Spots:** Facilities lack real-time inventory visibility of Indian Public Health Standards (IPHS) essential drugs (Oxytocin, Insulin, IFA) and cross-tier lab orders.

---

### 3. Proposed Solution: NalamMesh Digital Public Infrastructure (DPI)
NalamMesh is a **zero-downtime, offline-first integrated public healthcare platform** that bridges the entire continuum of care from grassroots frontline workers to apex district specialists:

```
[Sub-Centre / ASHA Worker] (Field Offline PWA + Voice Vitals)
         ↓ (On-device Edge AI Triage & Token Generation)
[Primary Health Centre - PHC] (OPD Queue + Diagnostics + Drug Stock)
         ↓ (Low-Bandwidth Assisted Teleconsultation)
[Community Health Centre - CHC] (First Referral Unit / CEmONC Emergency)
         ↓ (108 / 102 Ambulance Continuum Tracker)
[District Hospital - DH] (Specialist Apex Care + DHO Analytics Dashboard)
```

---

### 4. Six Core Application Modules

#### 🩺 Module 1: OPD Registration & Edge AI Digital Triage (`/opd`)
- **ABDM-Linked Longitudinal Records:** Lookup or register patients via 14-digit ABHA Health ID, Aadhaar last-4, Name, or Phone.
- **Multilingual Voice Intake:** Web Speech API parsing spoken vitals in Marathi (`मराठी`), Hindi (`हिन्दी`), and English (`en`).
- **Edge Neural Network Triage (TensorFlow.js):** 8-feature in-browser neural network classifying vitals (SpO2, Pulse, Blood Pressure, Temp, Blood Glucose, Resp Rate, AVPU sensorium, Maternal ANC, Child U5).
- **Automated Queue Token:** Generates token (e.g., `T-042`) with estimated wait time and priority routing.
- **ABDM / FHIR R4 Bundle Export:** Instant one-click download of compliant Ayushman Bharat JSON bundles.

#### 📊 Module 2: District & Facility Governance Dashboard (`/dashboard`)
- **District Level Census:** Live aggregates of total patients, pending referrals, active queue, and critical cases.
- **Maharashtra Health Continuum Tree:** Hierarchical topology of `DH Gadchiroli` $\to$ `SDH Aheri` $\to$ `CHC Etapalli` $\to$ `PHC Bhamragad` $\to$ `Sub-Centres Kothi & Govindpur`.
- **High-Risk Patient Action Alerts:** Proactive tracking of overdue Maternal ANC visits, Severe Acute Malnutrition (SAM), and uncontrolled Type-2 Diabetes.
- **IPHS Quality Benchmarks:** Real-time progress bars for Referral Completion Rate (78%), Average Wait Time (16 min), Drug Stock Level (82%), and Follow-up Adherence (91%).

#### 🔄 Module 3: Cross-Facility Referral Pipeline (`/referrals`)
- **5-Stage Kanban Workflow:** `Initiated` $\to$ `Accepted` $\to$ `In Transit` $\to$ `Completed` $\to$ `Redirected`.
- **108 / 102 Emergency Integration:** Live tracking of Advanced Life Support (108) and Janani Shishu Express (102) maternal ambulances.
- **Zero Referral Drop-off:** Clinical summary, vitals history, and handover logs passed seamlessly between facilities.

#### 📋 Module 4: Smart Queue & Token Calling Engine (`/queue`)
- **Hero "Now Serving" Display:** Giant token numbers with live doctor room assignment and elapsed consultation duration.
- **Priority Calling Algorithm:** Automatically prioritizes Emergency (Red) and Urgent (Yellow) patients over routine cases.
- **Emergency Priority Override:** Allows frontline nurses to flag deteriorating patients to jump the queue.
- **Full-Screen Waiting Room TV Display Mode:** Dedicated high-contrast display mode for OPD lobby projectors/televisions with bilingual Marathi/English headers.

#### 📹 Module 5: Assisted Specialist Teleconsultation (`/teleconsult`)
- **Grassroots-to-Specialist Bridge:** Connects CHO/ASHA at remote Sub-Centres with Specialist Doctors (e.g. Dr. Priya Sharma, MD OBGYN at District Hospital).
- **Low-Bandwidth 2G/3G Mode:** Switches to audio-only with structured real-time clinical notes stream for low-connectivity rural pockets.
- **Live Vitals Synchronization:** Doctor views real-time pulse oximeter, blood pressure, and previous visit timeline during call.
- **Instant e-Prescription & Direct Referral:** Specialist prescribes drugs and authorizes emergency ambulance dispatch in one click.

#### 💊 Module 6: Essential Medicine & Diagnostics Coordination (`/medicine`)
- **IPHS Essential Medicine Inventory:** Drug stock tracking (Adequate, Low, Out-of-Stock, Near-Expiry).
- **Emergency Reorder Alerts:** Automated alerts for critical life-saving drugs (Oxytocin, Insulin, IFA, Paracetamol).
- **Diagnostic Lab Orders Tracker:** Cross-tier lab test tracking (Fasting Blood Glucose, Sputum AFB for TB, Urine Albumin, Malaria Pf RDT) with abnormality flagging.

---

### 5. Technology Stack & Technical Innovations
| Layer | Technology | Purpose |
|---|---|---|
| **Frontend Framework** | Next.js 14 (App Router), React 18, TypeScript | High-performance, SEO-ready, server-rendered and static hybrid |
| **UI & Design System** | StitchMCP, Vanilla Tailwind CSS, Framer Motion | Custom healthcare palette (Deep Teal, Medical Blue, Warm Amber) |
| **Edge AI Engine** | TensorFlow.js (In-Browser Neural Network) | 100% offline triage classification with zero server dependency |
| **Offline Storage** | IndexedDB v2 (`idb` wrapper) | Stores longitudinal patients, visits, referrals, tokens, and drug inventory locally |
| **Interoperability** | ABDM Standards / FHIR R4 JSON Bundles | National Health Authority (NHA) & Ayushman Bharat compliant |
| **Speech Processing** | Web Speech API (Multilingual) | Voice vitals entry in Marathi, Hindi, and English |
| **Mapping Engine** | Leaflet.js (Offline Tile Caching) | Interactive district health facility maps and patient pins |
| **State Management** | Zustand (with LocalStorage Persistence) | Reactive, lightweight state across all 6 modules |

---

### 6. Key Differentiators / Why NalamMesh Wins (USP)
1. **100% Offline-Capable Edge AI:** Triage classification and record creation happen entirely inside the browser using TensorFlow.js and IndexedDB. Frontline workers can work deep inside forests without internet.
2. **True Continuum of Care (SC $\to$ PHC $\to$ CHC $\to$ DH):** Unlike single-facility hospital apps, NalamMesh binds all 5 tiers of the Indian public healthcare system together.
3. **Low-Bandwidth Telemedicine:** First teleconsultation interface optimized with 2G/3G audio-first fallback and structured chat for rural tribal terrain.
4. **Tailored for Maharashtra:** Fully localized in Marathi (`मराठी`), pre-configured with Gadchiroli district facility hierarchies, and integrated with state 108/102 emergency protocols.
5. **Zero-Drop Referral Kanban:** Eliminates paper referral loss and tracks patient arrival, transport mode, and admission in real time.
