#!/usr/bin/env python3
"""Builds the NalamMesh engineering handover PDF."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (BaseDocTemplate, Frame, KeepTogether, ListFlowable,
                               ListItem, PageBreak, PageTemplate, Paragraph, Spacer,
                               Table, TableStyle)

OUT = "NalamMesh_Handover.pdf"

NAVY = colors.HexColor("#1F3A6E")
DEEP = colors.HexColor("#13294B")
INK = colors.HexColor("#1C2534")
BODY = colors.HexColor("#33404F")
SLATE = colors.HexColor("#5A6B80")
RULE = colors.HexColor("#B9C5D6")
PALE = colors.HexColor("#EDF1F7")
ZEBRA = colors.HexColor("#F6F8FB")
AMBER = colors.HexColor("#B45309")
RED = colors.HexColor("#C0392B")
GREEN = colors.HexColor("#1E7A4D")
CODEBG = colors.HexColor("#F2F5F9")

PW, PH = A4
M = 17 * mm

ss = getSampleStyleSheet()


def S(name, **kw):
    base = dict(fontName="Helvetica", fontSize=9.4, leading=13.6, textColor=BODY,
                alignment=TA_LEFT, spaceAfter=5)
    base.update(kw)
    return ParagraphStyle(name, **base)


Body = S("Body")
Lead = S("Lead", fontSize=10.4, leading=15.4, textColor=INK, spaceAfter=8)
H1 = S("H1", fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=NAVY,
       spaceBefore=2, spaceAfter=3)
H2 = S("H2", fontName="Helvetica-Bold", fontSize=12.2, leading=16, textColor=NAVY,
       spaceBefore=13, spaceAfter=5)
H3 = S("H3", fontName="Helvetica-Bold", fontSize=10.2, leading=14, textColor=INK,
       spaceBefore=9, spaceAfter=3)
Small = S("Small", fontSize=8.4, leading=11.6, textColor=SLATE)
Cell = S("Cell", fontSize=8.5, leading=11.8)
CellB = S("CellB", fontSize=8.5, leading=11.8, fontName="Helvetica-Bold", textColor=INK)
CellH = S("CellH", fontSize=8.4, leading=11.4, fontName="Helvetica-Bold",
          textColor=colors.white)
Code = S("Code", fontName="Courier", fontSize=8.2, leading=11.8, textColor=INK,
         backColor=CODEBG, borderPadding=6, spaceBefore=4, spaceAfter=7)
Kicker = S("Kicker", fontName="Helvetica-Bold", fontSize=7.6, leading=10,
           textColor=AMBER)


def bullets(items, style=Body):
    return ListFlowable(
        [ListItem(Paragraph(t, style), leftIndent=11, value="circle") for t in items],
        bulletType="bullet", bulletFontSize=5, leftIndent=11, bulletOffsetY=1,
        spaceAfter=6,
    )


def table(rows, widths, header=True, zebra=True, align=None):
    data = []
    for r_i, row in enumerate(rows):
        out = []
        for c_i, cell in enumerate(row):
            if isinstance(cell, Paragraph):
                out.append(cell)
            else:
                st = CellH if (header and r_i == 0) else (CellB if c_i == 0 else Cell)
                out.append(Paragraph(str(cell), st))
        data.append(out)

    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
        ("BOX", (0, 0), (-1, -1), 0.7, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ]
    if header:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), NAVY)]
        if zebra:
            for i in range(2, len(data), 2):
                cmds.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    if align:
        for col, a in align.items():
            cmds.append(("ALIGN", (col, 0), (col, -1), a))
    t.setStyle(TableStyle(cmds))
    return t


def callout(title, text, tone=AMBER):
    inner = [Paragraph(title, S("ct", fontName="Helvetica-Bold", fontSize=9,
                                leading=12, textColor=tone, spaceAfter=3)),
             Paragraph(text, S("cb", fontSize=8.8, leading=12.6))]
    t = Table([[inner]], colWidths=[PW - 2 * M], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, tone),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFCF4")
         if tone == AMBER else colors.HexColor("#F6FAF7")),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


# ---------------------------------------------------------------- page furniture
def chrome(canv, doc):
    canv.saveState()
    if doc.page > 1:
        canv.setFont("Helvetica", 7.3)
        canv.setFillColor(SLATE)
        canv.drawString(M, PH - M + 5 * mm, "NalamMesh — Engineering Handover")
        canv.drawRightString(PW - M, PH - M + 5 * mm,
                             "Government of Maharashtra · Public Health Department")
        canv.setStrokeColor(RULE)
        canv.setLineWidth(0.5)
        canv.line(M, PH - M + 3.6 * mm, PW - M, PH - M + 3.6 * mm)
        canv.line(M, M - 4 * mm, PW - M, M - 4 * mm)
        canv.drawString(M, M - 8.4 * mm, "SIH 2026 · Problem Statement 26133")
        canv.drawRightString(PW - M, M - 8.4 * mm, f"Page {doc.page}")
    canv.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=M, rightMargin=M,
                      topMargin=M, bottomMargin=M,
                      title="NalamMesh — Engineering Handover",
                      author="NalamMesh", subject="Project handover documentation")
doc.addPageTemplates([PageTemplate(id="main",
                                   frames=[Frame(M, M, PW - 2 * M, PH - 2 * M, id="f")],
                                   onPage=chrome)])

E = []
W = PW - 2 * M


# ================================================================== COVER
E.append(Spacer(1, 30 * mm))
E.append(Paragraph("GOVERNMENT OF MAHARASHTRA · PUBLIC HEALTH DEPARTMENT",
                   S("cv1", fontName="Helvetica-Bold", fontSize=8.4, textColor=AMBER,
                     spaceAfter=10)))
E.append(Paragraph("NalamMesh", S("cv2", fontName="Helvetica-Bold", fontSize=34,
                                  leading=38, textColor=DEEP, spaceAfter=6)))
E.append(Paragraph("Engineering Handover &amp; Project Context",
                   S("cv3", fontSize=14, leading=19, textColor=NAVY, spaceAfter=14)))
E.append(Paragraph(
    "An offline-first public health platform for rural Maharashtra, modelled on "
    "Gadchiroli district. This document is everything a developer joining the "
    "project needs in order to work on it safely.",
    S("cv4", fontSize=10.6, leading=16, textColor=BODY, spaceAfter=20)))

E.append(table([
    ["Problem Statement", "SIH 2026 · PS 26133 — rural healthcare access and continuity"],
    ["Repository", "github.com/TharunS2006/HealthcareAI — working branch <b>new</b>"],
    ["Stack", "Next.js 14 (App Router, static export) · TypeScript · Zustand · IndexedDB"],
    ["Scale", "38 routes · 46 built pages · 9 offline stores · 7 modelled facilities"],
    ["Languages", "English, Hindi and Marathi — every citizen-facing screen is trilingual"],
], [40 * mm, W - 40 * mm], header=False))

E.append(Spacer(1, 12))
E.append(callout(
    "Read this section first: the one rule that matters",
    "This is a medical application. <b>No figure shown to a user may be invented.</b> "
    "Every number must come from a real record, a real computation, or be replaced with "
    "an explicit \"no data\" message. Several rounds of work on this codebase have been "
    "spent removing fabricated values; do not reintroduce them. Section 8 explains this "
    "in full.", RED))

E.append(PageBreak())


# ================================================================== 1. WHAT / WHY
E.append(Paragraph("1. What the project is", H1))
E.append(Paragraph(
    "NalamMesh is a public health platform built for the working conditions of "
    "Gadchiroli — a heavily forested district in eastern Maharashtra where connectivity "
    "is unreliable and the nearest specialist may be hours away.", Lead))

E.append(Paragraph("The three problems it addresses", H2))
E.append(table([
    ["Problem", "What the software does about it"],
    ["Connectivity fails. Facilities can be cut off for days.",
     "The device is the source of truth. All reads and writes hit local IndexedDB "
     "first; syncing to other facilities happens later, if a connection appears."],
    ["Records don't travel. Paper registers stay at the facility.",
     "A patient's triage result, vitals and history move with the referral, so the "
     "receiving tier is not starting blind."],
    ["The first contact is rarely a doctor — usually an ASHA or ANM.",
     "An on-device triage model scores urgency, with hard clinical rules layered above "
     "it that can only escalate, never downgrade."],
], [62 * mm, W - 62 * mm]))

E.append(Paragraph("The four-tier care network", H2))
E.append(Paragraph(
    "Indian rural public health is organised in tiers. The whole data model follows "
    "this hierarchy — referrals move <i>up</i> the tiers, and a facility's tier determines "
    "which services and entitlements apply there.", Body))
E.append(table([
    ["Tier", "Facility", "Modelled", "Role"],
    ["SC", "Sub-Centre", "2", "First contact; ANM / ASHA staffed"],
    ["PHC", "Primary Health Centre", "2", "Medical Officer, basic laboratory"],
    ["CHC", "Community Health Centre", "1", "Specialists, emergency obstetric care"],
    ["SDH", "Sub-District Hospital", "1", "Surgery, inpatient beds"],
    ["DH", "District Hospital", "1", "Apex referral destination"],
], [16 * mm, 55 * mm, 20 * mm, W - 91 * mm], align={2: "CENTER"}))
E.append(Paragraph(
    "Facility records live in <font face='Courier'>lib/data/facilities.ts</font> — real "
    "names, coordinates, bed capacity, staffing and services for seven Gadchiroli "
    "facilities.", Small))

E.append(PageBreak())


# ================================================================== 2. ARCHITECTURE
E.append(Paragraph("2. Architecture in one page", H1))
E.append(Paragraph(
    "The single most important architectural fact: <b>this application has no backend "
    "database.</b> It is a statically exported Next.js site whose data layer is the "
    "browser's own IndexedDB. Understand that and most of the design follows.", Lead))

E.append(Paragraph("Request and data flow", H2))
E.append(Paragraph(
    "UI component  -&gt;  Zustand store  -&gt;  lib/db.ts  -&gt;  IndexedDB (on device)<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|<br/>"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"
    "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;optional mesh "
    "relay (Socket.io, port 3001) -&gt; other facilities", Code))

E.append(Paragraph("Why each piece is there", H2))
E.append(table([
    ["Piece", "Why"],
    ["Static export<br/><font face='Courier' size='7.5'>output: 'export'</font>",
     "No server to be unreachable. The whole app is files that can be served from "
     "anywhere, cached by a service worker, or wrapped in the Android build."],
    ["IndexedDB via <font face='Courier' size='7.5'>idb</font>",
     "Structured, indexed, durable local storage. Survives refresh and restart. "
     "Schema is versioned — currently <b>v4</b> — with guarded upgrade handlers."],
    ["Zustand stores",
     "Thin layer between UI and the database. Writes are optimistic and roll back if "
     "the persist fails, so a clinical action never silently disappears."],
    ["Service worker<br/><font face='Courier' size='7.5'>public/sw.js</font>",
     "Hand-written, no PWA package. Pre-caches 29 routes so a cold start works with "
     "no network at all. Currently <b>v3.3.0</b>."],
    ["TensorFlow.js",
     "Runs the triage model on the device. No inference request ever leaves the "
     "handset, so triage behaves identically offline."],
    ["Socket.io mesh relay",
     "<b>Optional.</b> Relays records between facilities when any link exists. The app "
     "is fully functional without it."],
    ["Capacitor",
     "Wraps the static export as an Android app for field devices."],
], [40 * mm, W - 40 * mm]))

E.append(PageBreak())


# ================================================================== 3. CODEBASE MAP
E.append(Paragraph("3. Where things live", H1))
E.append(Paragraph("Spend ten minutes here before writing any code.", Lead))

E.append(table([
    ["Path", "Contents"],
    ["app/", "Next.js App Router pages — 38 routes. Citizen-facing at the root "
             "(<font face='Courier' size='7.5'>/opd</font>, "
             "<font face='Courier' size='7.5'>/queue</font>), staff screens under "
             "<font face='Courier' size='7.5'>/staff</font>."],
    ["lib/db.ts", "<b>The heart of the project.</b> IndexedDB schema, every read and "
                  "write, the audit trail. Read this file first."],
    ["lib/triage/model.ts", "Triage engine: TensorFlow.js model plus the clinical "
                            "override rules. See section 5."],
    ["lib/data/", "Seed and reference data: facilities, hospitals, patient services "
                  "and entitlements, statutory policy text."],
    ["lib/analytics/facilityMetrics.ts",
     "Derived measures — facility scorecards, travel-time savings, mortality-prevention "
     "telemetry. All computed, none asserted."],
    ["stores/", "Seven Zustand stores: patient, queue, referral, appointment, facility, "
                "auth, language."],
    ["components/gov/", "Shared government-portal chrome. "
                        "<font face='Courier' size='7.5'>PortalShell</font>, "
                        "<font face='Courier' size='7.5'>GovPanel</font>, "
                        "<font face='Courier' size='7.5'>Breadcrumb</font>, "
                        "<font face='Courier' size='7.5'>PortalAside</font>, header and "
                        "footer. See section 7."],
    ["public/sw.js", "The service worker. Bump "
                     "<font face='Courier' size='7.5'>CACHE_VERSION</font> whenever you "
                     "change the pre-cache list, or clients keep the stale shell."],
    ["scripts/*.mts", "Three verification suites. Run them before every commit."],
    ["server/mesh-server.ts", "The optional Socket.io relay."],
], [46 * mm, W - 46 * mm]))

E.append(Paragraph("Conventions you'll notice", H2))
E.append(bullets([
    "<b>Trilingual by inline object.</b> Most pages define a local "
    "<font face='Courier' size='8'>txt</font> or "
    "<font face='Courier' size='8'>pageTexts</font> object with "
    "<font face='Courier' size='8'>en / hi / mr</font> keys. "
    "<font face='Courier' size='8'>lib/i18n.ts</font> exists but the inline pattern is "
    "dominant — follow the file you're editing.",
    "<b>Verification scripts use dynamic imports.</b> "
    "<font face='Courier' size='8'>lib/</font> is CommonJS, so the "
    "<font face='Courier' size='8'>.mts</font> suites use "
    "<font face='Courier' size='8'>await import()</font>, not static imports.",
    "<b>Dates resolve after mount.</b> This is a static export: computing \"today\" "
    "during render bakes the build date into the HTML and then mismatches on hydration. "
    "Use <font face='Courier' size='8'>useEffect</font>.",
]))

E.append(PageBreak())


# ================================================================== 4. DATA LAYER
E.append(Paragraph("4. The data layer", H1))

E.append(Paragraph("Nine object stores (schema v4)", H2))
E.append(table([
    ["Store", "Holds"],
    ["patients", "Patient demographics, ABHA id, vitals, triage status, risk flags"],
    ["queue", "OPD tokens — registration, call and completion timestamps"],
    ["referrals", "Tier-to-tier transfers with status and dispatch timestamps"],
    ["appointments", "Citizen bookings that convert into queue tokens"],
    ["diagnostics", "Test orders and results"],
    ["medicineStock", "Facility-level stock against the IPHS essential drug list"],
    ["facilities", "The seven facility records"],
    ["auditLog", "Every clinical change, with actor and timestamp"],
    ["syncQueue", "Writes awaiting relay to other facilities"],
], [34 * mm, W - 34 * mm]))

E.append(Paragraph("Two rules enforced in lib/db.ts", H2))
E.append(Paragraph(
    "<b>1. Writes throw; they never silently no-op.</b> If a referral cannot be found, "
    "the update raises rather than returning quietly — a silent failure in a clinical "
    "path is worse than a crash.", Body))
E.append(Paragraph(
    "<font face='Courier' size='8'>if (!ref) throw new DatabaseError(`Referral ${id} not "
    "found — status not updated to ${status}`);</font>", Code))
E.append(Paragraph(
    "<b>2. Audit logging never throws.</b> The inverse rule. If the audit write fails, "
    "the clinical action has <i>already</i> been applied — so it logs the error and "
    "carries on rather than rolling back real care.", Body))

E.append(Paragraph("The audit trail", H2))
E.append(bullets([
    "Every change to a referral, queue entry, appointment or stock line records the "
    "acting staff member and a timestamp.",
    "The actor is module-level state — set it with "
    "<font face='Courier' size='8'>setCurrentActor(id, role)</font> on login.",
    "<b>Never write patient names into audit rows.</b> The audit surface is readable by "
    "the District Health Officer; it stores the token number and the record id, which "
    "already resolve to the patient for anyone entitled to see it. A PII leak here was "
    "found and fixed once already.",
    "Viewing is restricted to <font face='Courier' size='8'>MO</font>, "
    "<font face='Courier' size='8'>SPECIALIST</font> and "
    "<font face='Courier' size='8'>DHO</font>.",
]))

E.append(PageBreak())


# ================================================================== 5. TRIAGE
E.append(Paragraph("5. The triage engine — read before touching", H1))
E.append(Paragraph(
    "This is the highest-risk code in the project. It decides how urgently a patient is "
    "seen.", Lead))

E.append(Paragraph("Two decision paths", H2))
E.append(table([
    ["Path", "What it is"],
    ["NEURAL_NETWORK", "A TensorFlow.js model scores the case from vitals and symptoms "
                       "and returns RED, YELLOW or GREEN with a confidence."],
    ["CLINICAL_OVERRIDE", "27 hard rules sitting <i>above</i> the model — altered "
                          "consciousness, shock-range blood pressure, critical "
                          "respiratory rate, severe hypoglycaemia and others."],
], [40 * mm, W - 40 * mm]))

E.append(Spacer(1, 6))
E.append(callout(
    "The safety invariant — do not break this",
    "<b>Overrides escalate only.</b> A clinical rule can raise a patient's urgency. "
    "Nothing — not the model, not any later step in the flow — may lower a level that a "
    "rule has set. In a triage tool the failure that matters is the one that sends "
    "someone home. If you change this file, the escalate-only property must still hold.",
    RED))

E.append(Paragraph("How it is guarded", H2))
E.append(Paragraph(
    "<font face='Courier' size='8'>npm run verify:triage</font> runs 20 clinical cases "
    "covering both decision paths. It must stay at 20/20. Add a case whenever you add a "
    "rule.", Body))
E.append(Paragraph("Priority levels", H3))
E.append(table([
    ["Level", "Meaning", "Routing"],
    ["<font color='#C0392B'><b>RED</b></font>", "Emergency",
     "Immediate care or transfer to the highest reachable tier"],
    ["<font color='#B45309'><b>YELLOW</b></font>", "Urgent",
     "Seen the same day; escalate if vitals move"],
    ["<font color='#1E7A4D'><b>GREEN</b></font>", "Routine",
     "Standard OPD flow with follow-up scheduled"],
], [22 * mm, 30 * mm, W - 52 * mm]))

E.append(PageBreak())


# ================================================================== 6. MODULES
E.append(Paragraph("6. The modules", H1))
E.append(Paragraph(
    "Nine functional modules, all writing to the same local database — which is why a "
    "patient seen at a sub-centre is already known at the district hospital.", Lead))

E.append(table([
    ["Module", "Route", "What it does"],
    ["OPD Intake &amp; Triage", "/opd",
     "Registration, ABHA capture, vitals entry, runs triage, issues a token"],
    ["District Command", "/dashboard",
     "Indicators, facility network status, high-risk action list"],
    ["OPD Queue", "/queue",
     "Live token board; wait times computed from real call timestamps"],
    ["Referrals", "/referrals",
     "Tier-to-tier transfer with live transit tracking"],
    ["Appointments", "/appointments",
     "Citizen booking; slot capacity derived from actual facility staffing"],
    ["Medicine Stock", "/medicine", "IPHS drug list, low-stock and near-expiry alerts"],
    ["Diagnostics", "/diagnostics", "Test orders and results against the patient record"],
    ["High-Risk Follow-up", "/followup",
     "Scheduled recall for ANC, SAM and chronic cases"],
    ["Teleconsult", "/teleconsult",
     "Specialist link-up. <b>Labelled a simulated preview</b> — there is no WebRTC yet."],
    ["Facilities &amp; Services", "/facilities, /services-info",
     "Directory, entitlements, scheme eligibility (PMJAY gated to CHC and above)"],
    ["Audit Trail", "/audit", "Restricted to MO, Specialist and DHO"],
], [38 * mm, 27 * mm, W - 65 * mm]))

E.append(Paragraph(
    "Seven staff roles scope what each user sees: ASHA, ANM/CHO, Medical Officer, "
    "Specialist, Pharmacist, Lab Technician, District Health Officer.", Small))

E.append(PageBreak())


# ================================================================== 7. UI
E.append(Paragraph("7. UI conventions", H1))
E.append(Paragraph(
    "The interface deliberately imitates an Indian government department portal — NIC "
    "built, GIGW 3.0 compliant. It is modelled on india.gov.in, mohfw.gov.in and "
    "arogya.maharashtra.gov.in. This is a requirement, not a stylistic preference.", Lead))

E.append(Paragraph("Do", H2))
E.append(bullets([
    "Square corners. Radius 0–2px. Portals are built from bordered boxes.",
    "Separate content with a <b>1px rule</b>, never a drop shadow. All elevation is "
    "flattened globally in <font face='Courier' size='8'>tailwind.config.ts</font>.",
    "Put content in a <font face='Courier' size='8'>GovPanel</font> — a solid navy "
    "heading bar above a square bordered body.",
    "Present data in <b>tables</b> with a header row and alternating row shading.",
    "Keep type small and dense: body 12–13px, table text 12px, labels 11px.",
    "Use <font face='Courier' size='8'>PortalShell</font> for the three-column layout.",
]))

E.append(Paragraph("Do not — these read as machine-generated", H2))
E.append(bullets([
    "Coloured left accent rails on cards (the rotating blue/orange/green stripe). "
    "These were removed from seven files; do not bring them back.",
    "Large KPI tiles with oversized display numbers. Use a bordered indicator table.",
    "Pill badges carrying a checkmark glyph, such as &quot;Verified&quot; or &quot;Ready&quot;.",
    "Rounded cards with soft shadows in a uniform three-across grid.",
    "Icons inside coloured circles.",
    "Hover elevation.",
    "Emoji, anywhere.",
]))

E.append(Spacer(1, 4))
E.append(callout(
    "Layout trap that has already bitten once",
    "<font face='Courier'>Sidebar</font> is a fixed <font face='Courier'>w-64</font> "
    "with <font face='Courier'>flex-shrink-0</font>, because most pages still use the "
    "legacy flex layout. <font face='Courier'>PortalShell</font> therefore uses "
    "<b>explicit grid tracks</b> — <font face='Courier'>16rem / minmax(0,1fr) / "
    "20rem</font> — not 12-column fractions. Changing the sidebar to "
    "<font face='Courier'>w-full</font> makes it swallow the whole row on every "
    "unmigrated page. Two pages use PortalShell; thirteen still use the flex layout."))

E.append(PageBreak())


# ================================================================== 8. NO FABRICATION
E.append(Paragraph("8. The no-invented-data rule", H1))
E.append(Paragraph(
    "The most important convention in this codebase, and the one most easily broken by "
    "accident.", Lead))

E.append(Paragraph(
    "It is tempting, when a demo looks empty, to pad a number so the screen looks "
    "populated. In a medical tool that is not a cosmetic choice — it puts a figure in "
    "front of a clinician that nothing backs. Every one of the patterns below was found "
    "in this codebase and removed.", Body))

E.append(table([
    ["Anti-pattern", "Why it is wrong", "Do instead"],
    ["<font face='Courier' size='7.5'>patients.length + 152</font>",
     "Inflates a real count with an invented offset",
     "Show the real count, even if it is 5"],
    ["<font face='Courier' size='7.5'>count &gt; 0 ? count : '4'</font>",
     "Falls back to a fake number when the truth is zero",
     "Show zero — zero is information"],
    ["<font face='Courier' size='7.5'>78% Occupied</font> hardcoded",
     "Asserts a measurement nobody took",
     "Compute from facility bed records"],
    ["\"Avg response: 28 min\"",
     "A plausible-looking figure with no source",
     "Derive from timestamps, or omit"],
    ["Hardcoded dated notices",
     "Stale the day after they are written",
     "Compute forward from today"],
], [40 * mm, 52 * mm, W - 92 * mm]))

E.append(Paragraph("What good looks like", H2))
E.append(bullets([
    "<b>Bed occupancy</b> sums <font face='Courier' size='8'>beds.total</font> and "
    "<font face='Courier' size='8'>beds.occupied</font> across facility records, and "
    "renders \"Not reported\" when no facility has recorded capacity.",
    "<b>Queue wait times</b> are computed from "
    "<font face='Courier' size='8'>calledAt - registeredAt</font>. Where nobody has "
    "been called yet, the board says so instead of showing a placeholder.",
    "<b>Announcements</b> list the next occurrence of each recurring clinic day, "
    "computed from <font face='Courier' size='8'>nextOccurrence()</font> — so the dates "
    "move on their own.",
    "<b>Referral transit clocks</b> only run where a real dispatch timestamp exists. A "
    "referral with no dispatch shows no clock rather than a fabricated elapsed time.",
]))

E.append(Spacer(1, 4))
E.append(callout("Rule of thumb",
                 "If you cannot point at the record a number came from, it does not go "
                 "on the screen. State a real zero, or say \"no data\".", GREEN))

E.append(PageBreak())


# ================================================================== 9. RUNNING / TESTING
E.append(Paragraph("9. Running and verifying it", H1))

E.append(Paragraph("Local development", H2))
E.append(Paragraph(
    "git clone https://github.com/TharunS2006/HealthcareAI.git<br/>"
    "cd HealthcareAI &amp;&amp; git checkout new<br/>"
    "npm ci<br/>"
    "npm run dev        # app on :3000<br/>"
    "npm run dev:full   # app on :3000 + mesh relay on :3001", Code))

E.append(Paragraph("Before every commit", H2))
E.append(Paragraph(
    "npx tsc --noEmit<br/>"
    "npm run verify:triage     # 20/20 clinical cases — must not drop<br/>"
    "npm run verify:metrics    # facility scorecard calculations<br/>"
    "npm run verify:services   # entitlements and clinic schedules<br/>"
    "npm run build             # must produce 46 pages", Code))

E.append(Paragraph("Testing offline properly", H2))
E.append(Paragraph(
    "Do not trust DevTools' \"Offline\" toggle — during this project it left "
    "<font face='Courier' size='8'>navigator.onLine</font> true and requests still "
    "succeeded. <b>Kill the server instead.</b> Build, serve the "
    "<font face='Courier' size='8'>out/</font> directory, load the app, stop the "
    "server, then navigate. That is how the offline claims were verified: a route never "
    "visited since install rendered from cache, and a clinical write persisted with "
    "audit rows going from 1 to 3.", Body))

E.append(Paragraph("Gotchas that cost time", H2))
E.append(table([
    ["Symptom", "Cause and fix"],
    ["A route 404s in dev but is fine in the build",
     "Stale dev route manifest, usually after "
     "<font face='Courier' size='7.5'>npm run build</font> wiped "
     "<font face='Courier' size='7.5'>.next</font> under a running dev server. "
     "Stop dev, <font face='Courier' size='7.5'>rm -rf .next</font>, restart."],
    ["Pages render unstyled",
     "Same cause — the build removed the dev server's assets."],
    ["Offline start misses a new page",
     "You added a route without adding it to "
     "<font face='Courier' size='7.5'>PRECACHE_ROUTES</font> and bumping "
     "<font face='Courier' size='7.5'>CACHE_VERSION</font> in "
     "<font face='Courier' size='7.5'>public/sw.js</font>."],
    ["Hydration mismatch on a date",
     "A date computed during render in a static export. Move it into "
     "<font face='Courier' size='7.5'>useEffect</font>."],
    ["Sidebar swallows the page",
     "See the layout trap in section 7."],
], [50 * mm, W - 50 * mm]))

E.append(PageBreak())


# ================================================================== 10. STATE / NEXT
E.append(Paragraph("10. Where the project stands", H1))

E.append(Paragraph("Verified working", H2))
E.append(table([
    ["Check", "Status"],
    ["Production build", "Passes — 46 static pages"],
    ["TypeScript", "Clean, no errors"],
    ["Triage clinical suite", "20 / 20, both decision paths exercised"],
    ["Facility metrics suite", "Passing"],
    ["Services &amp; entitlements suite", "Passing"],
    ["Offline app shell", "29 routes pre-cached, verified with the server stopped"],
    ["Console errors", "None across all 38 screens"],
], [70 * mm, W - 70 * mm]))

E.append(Paragraph("Known gaps — be honest about these", H2))
E.append(bullets([
    "<b>Teleconsult has no WebRTC.</b> It is a simulated preview and is labelled as "
    "such in the UI. Do not describe it as working video consultation.",
    "<b>The UI rework is partial.</b> Two pages use "
    "<font face='Courier' size='8'>PortalShell</font>; thirteen still use the legacy "
    "flex layout. They have picked up the global token changes and lost their accent "
    "rails, but their card grids have not yet become tables.",
    "<b>The seven statutory policy pages are English-only</b> while the rest of the "
    "portal is trilingual. Defensible — most state portals do the same — but "
    "inconsistent.",
    "<b>No Vercel deployment is linked.</b> The repository is not connected to a "
    "Vercel project, so pushes do not deploy.",
]))

E.append(Paragraph("Suggested first tasks for a new developer", H2))
E.append(bullets([
    "Read <font face='Courier' size='8'>lib/db.ts</font> end to end, then "
    "<font face='Courier' size='8'>lib/triage/model.ts</font>.",
    "Run all three verification suites and make sure you understand what each asserts.",
    "Migrate one legacy page to "
    "<font face='Courier' size='8'>PortalShell</font> — "
    "<font face='Courier' size='8'>/queue</font> is a good first one — and convert its "
    "card grid to a table.",
    "Do the offline test yourself, by killing the server. It is the clearest way to "
    "understand what the architecture actually buys.",
]))

E.append(Spacer(1, 10))
E.append(callout(
    "If you remember three things",
    "<b>1.</b> The device is the source of truth — there is no backend. &nbsp;"
    "<b>2.</b> Triage overrides escalate only. &nbsp;"
    "<b>3.</b> Never put a number on screen that you cannot trace to a record.", NAVY))

doc.build(E)
print("built", OUT)
