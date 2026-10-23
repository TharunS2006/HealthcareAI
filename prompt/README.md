# Gram Swasthya — Integrated Rural Public Healthcare Platform
### Government Website — Master Build Prompt Pack (v2)

> **What this is:** An upgraded, production-ready rewrite of the original "Master Project Prompt."
> It converts the phrase-by-phrase decomposition into **four files** you can feed to any AI coding assistant
> (Claude, ChatGPT, Gemini, Cursor, etc.) **module-by-module**. Every feature is defined with **frontend + backend +
> acceptance criteria + edge cases**, so the health software is *crystal clear and works at all costs*.

---

## 📁 File Index

| File | Purpose | Feed this when… |
|---|---|---|
| `00_OVERVIEW_ARCHITECTURE.md` | Product definition, government-website framing, roles, pinned tech stack, architecture, data model, API conventions, non-functional requirements, global "works at all costs" rules, traceability, judge Q&A, build order | You are starting the project or onboarding a new AI assistant |
| `01_FRONTEND_PROMPT.md` | The complete **frontend** prompt: government look & feel, GIGW compliance, design system, accessibility, multilingual, offline PWA, routing/page map, component specs, forms & validation, quality bar | You are building **any UI** (citizen portal or staff portal) |
| `02_FEATURES_PROMPT.md` | The complete **features** prompt: all 16 modules, each with Frontend instruction + Backend instruction + state machine + edge cases + acceptance checklist + judge defense | You are building **a specific feature** (copy only that module's block) |

---

## 🚀 How to Use (Recommended Workflow)

1. **Start** by feeding `00_OVERVIEW_ARCHITECTURE.md` as the system/context prompt. This pins the stack, data model and global rules so the assistant never "invents" a different architecture.
2. **Build the shell** with `01_FRONTEND_PROMPT.md` — get the government look, routing, auth screens, i18n, and offline layer working first.
3. **Build features in dependency order** (see the Build Order roadmap in the Overview). For each module, copy **only that module's block** from `02_FEATURES_PROMPT.md` into a fresh chat/sprint ticket.
4. **Gate every module** on its *Acceptance Criteria* checklist before moving on. Nothing is "done" unless it passes the checklist.

## ✅ Definition of "Working" (non-negotiable, applies to every feature)

A feature is **NOT done** until ALL of these pass:

- [ ] Happy path works end-to-end with seeded demo data
- [ ] At least **2 edge cases** from the module's edge-case list are handled gracefully (no crash, no blank screen)
- [ ] Role-based access is enforced (a role without permission gets `403`, and the button is hidden)
- [ ] Every write action creates an **Audit Log** entry (who, what, when, where)
- [ ] Every user-visible string has an **i18n key** (EN + HI + TA minimum)
- [ ] **Offline behavior** is defined (works offline, or shows a clear "needs connectivity" state — never a spinner forever)
- [ ] Input validation exists on **both** client and server
- [ ] Demo seed data exists so the feature can be shown to a judge in under 60 seconds

---

## 🎯 Target Audience & Deployment Framing

- **Primary:** Government of India / State Health Department (NHM) — deployed as `*.gov.in` style portals.
- **Citizen portal:** `gramswasthya.gov.in` (public) — service discovery, queue booking, own-record view, emergency, medicine availability.
- **Staff portal:** `staff.gramswasthya.gov.in` (login required) — ASHA/ANM/CHO/MO/Specialist/Pharmacist/Lab/Admin dashboards.
- **Principle:** *Strengthen, not replace*, the public system — every flow routes through the government facility hierarchy.

## ⚠️ Assumptions (override if you disagree)

- Default languages: **English, Hindi, Tamil** (configurable array — swap for your target state).
- Default stack: **React + Vite + TypeScript (PWA) · Node.js + Express + Prisma · PostgreSQL** (swap instructions included).
- ABDM/ABHA integration is **mock/sandbox-shaped** but the data model is FHIR-R4-compliant (judges probe this).
- Hackathon demo scale: ~25 facilities, ~500 patients of seed data, single `docker-compose` deploy.
