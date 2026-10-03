# 01 — Frontend Prompt (Government Website)

> Feed this as ONE prompt when building any UI. It defines the government look, GIGW/accessibility rules,
> multilingual + voice, offline PWA behavior, the full page map, and a component inventory with spec.
> It applies to BOTH portals (citizen + staff) as a single PWA with role-based routing.

---

## 1. Objective

Build the **Gram Swasthya** government website as a single **Progressive Web App** (React 18 + Vite + TypeScript + Tailwind + i18next + Dexie/IndexedDB + vite-plugin-pwa) with two role-based shells:

1. **Citizen Portal** — public, low-literacy friendly, voice/icon-first.
2. **Staff Portal** — authenticated, task-oriented, data-dense, works offline.

**Design intent:** it must look like an **official Government of India health portal** (trustworthy, clean, accessible), not a startup app. A citizen must instantly recognize it as government.

---

## 2. Government Design System

### 2.1 Colors (tokenized in Tailwind)

| Token | Hex | Use |
|---|---|---|
| `gov-navy` | `#1F3A6E` | Primary buttons, header bands, active nav |
| `gov-navy-dark` | `#16294E` | Header background, footer |
| `gov-saffron` | `#FF9933` | Accents, highlights, warnings |
| `gov-green` | `#138808` | Success, "available/stock" indicators |
| `gov-red` | `#C62828` | Errors, emergency, "out of stock" |
| `gov-amber` | `#F9A825` | "low stock", pending states |
| `gov-bg` | `#F4F6FA` | Page background |
| `gov-surface` | `#FFFFFF` | Cards, tables |
| `gov-text` | `#1A1A1A` | Body text |

- **Tricolor stripe:** a 4px horizontal bar (`#FF9933 → #FFFFFF → #138808`) at the very top of every page.
- **Emblem:** Ashoka Chakra / GoI emblem (SVG) in header, left-aligned.

### 2.2 Typography
- `Noto Sans` (Latin + Devanagari) and `Noto Sans Tamil` for Tamil; system fallback.
- Base 16px; body 1rem/1.6; scale: H1 2rem, H2 1.5rem, H3 1.25rem.
- **Font-size toggle (A / A+) persisted in localStorage** — required by GIGW.

### 2.3 Global layout
- **Header (citizen):** tricolor stripe → emblem + "Government of India · भारत सरकार" (small) → portal title "Gram Swasthya | ग्राम स्वास्थ्य | கிராம சுகாதாரம்" → language switcher → Login (OTP/ABHA).
- **Header (staff):** role badge, facility selector (staff can be mapped to one facility), language switcher, logout.
- **Footer:** 104 (Health Helpline) · 108 (Ambulance) · 112 (Emergency) · RTI · Sitemap · Accessibility Statement · Feedback/Grievance · Copyright.
- **Emergency FAB:** floating red button bottom-right **on every screen** (one-tap emergency — Module 13).

### 2.4 Component inventory (build each once, reuse everywhere)

| Component | Spec |
|---|---|
| `GovButton` | Variants: primary/secondary/danger/ghost; min 44px touch target; loading state; disabled state |
| `GovCard` | White, 8px radius, subtle border |
| `GovTable` | Sticky header, zebra rows, empty state, responsive → card list on mobile |
| `StatusBadge` | Enum-driven: e.g. WAITING(gray) · CALLED(blue) · SERVED(green) · OVERDUE(red) · LOW STOCK(amber) |
| `FormField` | Label + required marker + inline error text + `aria-describedby` |
| `OTPInput` | 4/6 digit boxes, auto-advance, resend timer |
| `OfflineBanner` | Appears when navigator.onLine === false: "You are offline — changes will sync later" |
| `Toast` | Success/error/info; auto-dismiss; aria-live polite |
| `Modal` | Focus trap, ESC close, aria-modal |
| `ConfirmDialog` | For irreversible actions (complete referral, dispatch emergency) |
| `EmptyState` | Icon + message + action button |
| `ErrorState` | Message + Retry button |
| `LoadingSkeleton` | Shimmer placeholders (no spinners forever) |
| `QueueTicket` | Token number + position + estimated wait |
| `VitalInput` | Numeric steppers for BP/Temp/SpO2/Weight with unit + range validation |
| `SymptomPicker` | Icon grid (fever, cough, pain…) + voice input |
| `Timeline` | Vertical state timeline for referrals/diagnostics |
| `StockCard` | Drug name + quantity + AVAILABLE/LOW/OUT badge |
| `TeleconsultRoom` | Jitsi iframe + vitals sidebar + notes + end-call → auto-save |
| `ReferralForm` | From/To facility (dropdown filtered by hierarchy), urgency, reason, summary |
| `DashboardChart` | Recharts line/bar; empty & loading states |
| `ReadAloudButton` | Reads screen text via Web Speech API |

---

## 3. Accessibility & GIGW Checklist (REQUIRED)

- [ ] WCAG 2.1 AA contrast (4.5:1 body, 3:1 large text)
- [ ] All images/icons have `alt`/`aria-label`; decorative ones `aria-hidden`
- [ ] Full keyboard navigation (Tab order logical; skip-to-content link)
- [ ] Visible focus ring on every interactive element
- [ ] Every form input has `<label>` + `aria-describedby` for errors
- [ ] Modals trap focus and close on ESC
- [ ] `aria-live="polite"` for toasts/queue announcements; `aria-live="assertive"` for emergency alerts
- [ ] Font-size toggle (A/A+) + high-contrast mode toggle
- [ ] "Read aloud" button on triage, service discovery, referral status pages
- [ ] Color is never the only signal (badges always include text)
- [ ] Official header/footer + helplines + RTI + accessibility statement (GIGW)

---

## 4. Multilingual & Voice (Module 12 support)

- **i18next** with locales `en`, `hi`, `ta` (extensible array).
- Language switcher in header (persisted to localStorage; respects `lang` attribute on `<html>`).
- **Zero hard-coded strings** — every visible label/text/error from translation keys.
- Voice: **Web Speech API** —
  - STT (mic button) on triage/symptom entry and patient search.
  - TTS (`ReadAloudButton`) on key patient-facing screens.
- Numbers/dates localized (`toLocaleString`).

---

## 5. Offline-First PWA (Module 11 support)

- **Service worker** (Workbox): precache shell + static assets; cache-first for GET APIs; stale-while-revalidate for lists.
- **Dexie.js (IndexedDB)** stores: patient queue, draft forms, follow-up tasks, last-synced facility/stock snapshots.
- **Write queue:** any failed POST while offline is queued with an `Idempotency-Key` and replayed via `/sync/upload` on reconnect.
- **UI signals:** `OfflineBanner`, "sync pending (n)" badge, last-synced timestamp.
- Airplane-mode must NOT blank the app: cached lists still render; forms save drafts.

---

## 6. Routing & Page Map

### Citizen Portal (`/`)
| Route | Page | Key states |
|---|---|---|
| `/` | Home — helpline banner, big buttons (Find facility, Book queue, My record, Emergency) | offline banner |
| `/services` | Service discovery (facility directory, search by service/name, map/list, "what's available where") | loading, empty (no results) |
| `/triage` | Assisted triage (icon + voice symptom entry) → result tier + suggested dept | loading, mic error |
| `/queue` | Book token / live queue position per facility+dept | loading, offline (draft) |
| `/record` | My LHR (OTP/ABHA login): visits, prescriptions, diagnostics, referrals, immunizations | loading, empty, error |
| `/referrals/:id` | Referral status timeline | loading, not-found |
| `/medicine` | Medicine availability lookup (drug → where available) | loading, empty |
| `/emergency` | Emergency escalation confirm screen | confirm dialog |
| `/login` | OTP / ABHA login | OTP error, resend |

### Staff Portal (`/staff`)
| Route | Page | Roles |
|---|---|---|
| `/staff/login` | Staff login (phone + password/OTP) | all |
| `/staff/home` | Role home: task list / today's queue / alerts | all (role-tuned) |
| `/staff/patients` | Patient search + registration (ABHA link) | R2+ |
| `/staff/patients/:id` | Patient 360° (LHR, timeline, cohorts, actions) | R2+ |
| `/staff/triage` | Assisted triage entry | R2–R4 |
| `/staff/teleconsult` | Teleconsult room + specialist calendar | R2–R5 |
| `/staff/queue` | Facility queue board (call next, no-show) | R3–R4, R8 |
| `/staff/referrals` | Referral list (incoming/outgoing) + create | R2–R4 |
| `/staff/diagnostics` | Diagnostic orders + result entry | R3–R4, R7 |
| `/staff/stock` | Medicine stock update | R6, R8 |
| `/staff/followups` | Follow-up task list per cohort | R2–R3 |
| `/staff/dashboard` | Facility dashboard | R8–R9 |
| `/staff/district` | District dashboard + scorecards | R9 |
| `/staff/admin` | Users, facility master data, audit viewer | R10 |

---

## 7. State Management & API Client

- Light global state (React Context/Zustand): `auth`, `currentFacility`, `locale`, `onlineStatus`, `syncQueue`.
- **API client wrapper** enforces: base URL, JWT attach, refresh-on-401, envelope parsing, error → `ErrorState`, offline → queue write, `Idempotency-Key` on POSTs.

---

## 8. Forms & Validation (client-side mirrors server)

| Field | Rule |
|---|---|
| Phone (IN) | `^[6-9]\d{9}$` |
| ABHA ID | 14 digits (checksum in backend) |
| Age/DOB | age ≥ 0 and ≤ 130 |
| BP | 60–260 / 40–160 mmHg |
| Temp | 32–43 °C |
| SpO2 | 50–100 % |
| Weight | 0.5–300 kg |
| Referral reason | required, ≥ 10 chars |
| OTP | 4–6 digits, 5 attempts max, resend after 30 s |

---

## 9. Performance Budget (REQUIRED)

- LCP < 2.5s on 3G · JS bundle < 300 KB gzip · no layout shift (CLS < 0.1) · images lazy-loaded · fonts `font-display: swap`.

---

## 10. Frontend Acceptance Checklist ("UI done when…")

- [ ] GIGW header/footer present on every page (citizen portal)
- [ ] i18n keys exist for ALL strings (EN/HI/TA) — grep shows zero hard-coded English strings
- [ ] Every screen implements loading / empty / error / success states
- [ ] Works in airplane mode: cached pages render, forms save drafts, offline banner shows
- [ ] Keyboard-only navigation passes a full flow (login → register → triage → queue)
- [ ] Screen reader announces queue calls and emergency alerts
- [ ] Font-size and contrast toggles work
- [ ] Mobile-first: all flows usable at 360px width
- [ ] Emergency FAB reachable from every screen

---

## 11. Deliverables

1. PWA with both portals, routing, guards, and the design system above.
2. i18n resource files (`en.json`, `hi.json`, `ta.json`) — full key set.
3. Service worker + offline sync queue wired to `/sync`.
4. Component library implemented per the inventory table.
5. Seed-data-driven demo that completes the judge walkthrough (see Features file).
