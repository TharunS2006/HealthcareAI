"""
NalamMesh — District Reporting Service (FastAPI)

WHY THIS EXISTS
---------------
The clinical platform is device-first: every facility's records live in that
device's own IndexedDB, and the mesh relay only forwards them between peers.
That design is what lets a sub-centre keep working when it is cut off for days,
and it keeps patient data on the device that captured it.

It has one honest cost: nobody can answer a district-wide question. "How many
RED cases across all seven facilities this week?" has no home in that
architecture, because there is no place that sees all seven.

This service is that place, and nothing more. Facilities push a reduced,
de-identified summary of what they handled; the district queries aggregates.

WHAT IT IS NOT
--------------
It is not the clinical source of truth, and the app never reads from it. If this
service is down, care continues — which is the whole point. Nothing here is on
the path between a health worker and their patient's record.
"""

import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, SQLModel, create_engine, func, select
from starlette.concurrency import run_in_threadpool

# Imported for its side effect — see app/env.py. Must precede the first
# os.environ.get below, which is DATABASE_URL.
from . import env  # noqa: F401
from .access import identity_from_request, require
from .chat_engine import _chat_completion, _resolve_provider, chat_hosting
from .chat_guard import ChatCaller, chat_access, client_address, redact_identifiers
from .hardening import BodySizeLimit, api_docs_enabled, security_headers
from .models import (AccessLog, CareReferral, Encounter, Facility, FacilityTier,
                     PatientRecord, Referral, ReferralStatus, TriagePriority)
from .schemas import (AccessLogEntry, AccessLogPage, CareReferralIn, ChatIn,
                      ChatOut, DistrictSummary, EncounterIn, FacilityIn,
                      FacilityScorecard, IncomingCase, IncomingList,
                      IngestReceipt, PatientRecordIn, ReferralIn, StoreDump,
                      StoredPatient, StoredReferral, TierBreakdown,
                      TriageBreakdown)


# Cloud deploy note: point DATABASE_URL at a managed Postgres instance (Neon,
# Supabase, Render Postgres, ...) and SQLModel handles the rest — the table
# definitions in models.py are database-agnostic. SQLite remains the default
# so local dev and the offline demo need no external service.
DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./district.db")
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=_connect_args)



def _aware(value: Optional[datetime]) -> Optional[datetime]:
    """
    Coerce a naive datetime to UTC.

    Clients legitimately send local ISO strings without an offset
    ("2026-09-22T09:30:00"). SQLModel stores only timezone-aware values, so
    anything naive is treated as UTC rather than rejected at the boundary.
    """
    if value is None or value.tzinfo is not None:
        return value
    return value.replace(tzinfo=timezone.utc)


def _record_columns(payload) -> dict:
    """
    Column projection for a patient upload.

    The payload is stored verbatim; these columns only exist so the service can
    filter and sort without parsing every JSON blob. Where the two disagree the
    payload is the record — nothing clinical is ever read back out of a column.
    """
    return {
        "facility_id": payload.facility_id,
        "name": payload.name,
        "age": payload.age,
        "gender": payload.gender,
        "triage_priority": payload.triage_priority,
        "updated_at": _aware(payload.updated_at),
        "payload": json.dumps(payload.payload),
    }


def _referral_columns(payload) -> dict:
    """Column projection for a referral upload. Same contract as above."""
    return {
        "patient_id": payload.patient_id,
        "from_facility_id": payload.from_facility_id,
        "to_facility_id": payload.to_facility_id,
        "status": payload.status,
        "priority": payload.priority,
        "reason": payload.reason,
        "clinical_summary": payload.clinical_summary,
        "transport_mode": payload.transport_mode,
        "eta_minutes": payload.eta_minutes,
        "raised_at": _aware(payload.raised_at),
        "updated_at": _aware(payload.updated_at),
        "payload": json.dumps(payload.payload),
    }


def _normalise(payload_dict: dict) -> dict:
    """Apply _aware to every datetime field in an ingest payload."""
    return {k: _aware(v) if isinstance(v, datetime) else v for k, v in payload_dict.items()}


def get_session():
    with Session(engine) as session:
        yield session


@asynccontextmanager
async def lifespan(app: FastAPI):
    SQLModel.metadata.create_all(engine)
    yield


_DOCS = api_docs_enabled()
app = FastAPI(
    title="NalamMesh — District Reporting Service",
    description=__doc__,
    version="1.0.0",
    lifespan=lifespan,
    contact={"name": "District Health Office"},
    # API_DOCS=off hides /docs, /redoc and /openapi.json on a deployment that
    # does not want its routes described to whoever can reach it.
    docs_url="/docs" if _DOCS else None,
    redoc_url="/redoc" if _DOCS else None,
    openapi_url="/openapi.json" if _DOCS else None,
)

# The clinical app and the relay run on other origins.
# "*" suits the LAN demo, where the client's origin is whatever laptop or phone is
# on the network. Once this runs on a public cloud host, set CORS_ORIGINS to the
# comma-separated list of deployed frontend origins so the chat endpoint (which
# spends a metered API key) is not callable from any page on the internet.
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)
# An oversized body is refused before any route reads it.
app.add_middleware(BodySizeLimit)
app.middleware("http")(security_headers)


# ─────────────────────────── access log ───────────────────────────
#
# The assistant and the health probe carry no records; everything else under
# /api/v1 is logged, refused requests included (models.AccessLog).
_UNLOGGED = {"/api/v1/chat"}


def _write_access(entry: AccessLog) -> None:
    with Session(engine) as session:
        session.add(entry)
        session.commit()


@app.middleware("http")
async def access_log(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path.startswith("/api/v1/") and path not in _UNLOGGED:
        # The token's claims, without asking the relay: the log records who a
        # request said it was, refused or not, and must not block the loop.
        who = identity_from_request(request, check_relay=False)
        entry = AccessLog(
            user_id=who.user_id if who else None,
            role=who.role if who else None,
            facility_id=who.facility_id if who else None,
            method=request.method,
            path=path,
            query=str(request.url.query)[:300] or None,
            status=response.status_code,
            detail=getattr(request.state, "audit_detail", None),
            client=client_address(request),
        )
        try:
            await run_in_threadpool(_write_access, entry)
        except Exception as exc:  # the log must never take the request down with it
            print(f"WARNING: access log write failed: {exc}", flush=True)
    return response


def _note(request: Optional[Request], detail: str) -> None:
    """Attach what a request carried to its access-log row (no-op when called directly)."""
    if request is not None:
        request.state.audit_detail = detail


# ────────────────────────────── health ──────────────────────────────

@app.get("/", tags=["service"], summary="What this service is and where to look")
def root():
    # Opening the service's address in a browser used to answer {"detail":"Not Found"},
    # which reads as "the service is broken". It is an API, so say so and point on.
    return {
        "service": "NalamMesh District Reporting Service",
        "status": "running",
        "health": "/health",
        "api_docs": "/docs",
        "note": "An API for the NalamMesh app, not a web page. Open the app itself to use NalamMesh.",
    }


@app.get("/health", tags=["service"], summary="Liveness and store depth")
def health(session: Session = Depends(get_session)):
    chat = _resolve_provider()
    return {
        "status": "healthy",
        "facilities": session.exec(select(func.count()).select_from(Facility)).one(),
        "encounters": session.exec(select(func.count()).select_from(Encounter)).one(),
        "referrals": session.exec(select(func.count()).select_from(Referral)).one(),
        # The three counts above are the analytics tables. These two are the
        # record-sync store behind the pre-arrival board, and they are the ones
        # a monitor actually cares about: without them /health reported
        # "referrals: 0" while eight uploaded cases were sitting in the store.
        "patient_records": session.exec(select(func.count()).select_from(PatientRecord)).one(),
        "care_referrals": session.exec(select(func.count()).select_from(CareReferral)).one(),
        # Named so an operator can see, from one URL, whether the cloud
        # assistant will answer at all and which provider is going to answer —
        # the question that "the chatbot says it is unavailable" always turns
        # out to be. Never the key itself, only which variable was found.
        "chat_provider": chat[0] if chat else None,
        "chat_model": chat[1] if chat else None,
        # "self-hosted" or "external": whether a question leaves the department's
        # own infrastructure — the first thing a data-protection review asks.
        "chat_hosting": chat_hosting(chat[0] if chat else None),
        "note": "Reporting only. Clinical care does not depend on this service.",
    }


# ────────────────────────────── chat assistant ──────────────────────────────

@app.post(
    "/api/v1/chat",
    response_model=ChatOut,
    tags=["chat"],
    summary="Layer 2 of the chat assistant — cloud LLM, grounded in client-supplied context",
)
def chat(payload: ChatIn, caller: ChatCaller = Depends(chat_access)):
    # chat_access has already applied the sign-in policy and the rate limit.
    # A signed-in caller's role comes from their token, never from the body.
    question, _ = redact_identifiers(payload.question)
    who = caller.identity
    answer, model = _chat_completion(
        question, payload.context, who.role if who else payload.role, payload.language,
        role_verified=who is not None,
    )
    return ChatOut(answer=answer, model=model)


# ────────────────────────────── ingest ──────────────────────────────

@app.post(
    "/api/v1/facilities",
    dependencies=[Depends(require("staff:workspace"))],
    response_model=IngestReceipt,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["ingest"],
    summary="Register or update a reporting facility",
)
def upsert_facility(payload: FacilityIn, session: Session = Depends(get_session)):
    existing = session.get(Facility, payload.id)
    if existing:
        for k, v in _normalise(payload.model_dump()).items():
            setattr(existing, k, v)
        existing.last_reported_at = datetime.now(timezone.utc)
        record = existing
    else:
        record = Facility(**_normalise(payload.model_dump()), last_reported_at=datetime.now(timezone.utc))
    session.add(record)
    session.commit()
    return IngestReceipt(accepted=True, id=payload.id, kind="facility")


@app.post(
    "/api/v1/encounters",
    dependencies=[Depends(require("staff:workspace"))],
    response_model=IngestReceipt,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["ingest"],
    summary="Report a de-identified clinical encounter",
)
def ingest_encounter(payload: EncounterIn, session: Session = Depends(get_session)):
    if not session.get(Facility, payload.facility_id):
        raise HTTPException(404, f"Unknown facility '{payload.facility_id}' — register it first")
    # Idempotent: a device replaying its queue must not double-count.
    if session.get(Encounter, payload.id):
        return IngestReceipt(accepted=True, id=payload.id, kind="encounter", duplicate=True)
    session.add(Encounter(**_normalise(payload.model_dump())))
    session.commit()
    return IngestReceipt(accepted=True, id=payload.id, kind="encounter")


@app.post(
    "/api/v1/referrals",
    dependencies=[Depends(require("staff:workspace"))],
    response_model=IngestReceipt,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["ingest"],
    summary="Report a tier-to-tier referral",
)
def ingest_referral(payload: ReferralIn, session: Session = Depends(get_session)):
    for fid in (payload.from_facility_id, payload.to_facility_id):
        if not session.get(Facility, fid):
            raise HTTPException(404, f"Unknown facility '{fid}' — register it first")
    existing = session.get(Referral, payload.id)
    if existing:
        # Referrals progress; a later report supersedes an earlier one.
        for k, v in _normalise(payload.model_dump()).items():
            setattr(existing, k, v)
        session.add(existing)
        session.commit()
        return IngestReceipt(accepted=True, id=payload.id, kind="referral", updated=True)
    session.add(Referral(**_normalise(payload.model_dump())))
    session.commit()
    return IngestReceipt(accepted=True, id=payload.id, kind="referral")


# ─────────────────── clinical records (pre-arrival hand-off) ───────────────────
#
# These three carry identifiable health data, unlike everything in the ingest
# section above. They exist so a receiving facility can see who is coming and
# ready the right equipment before the ambulance arrives.

@app.post(
    "/api/v1/records/patients",
    dependencies=[Depends(require("staff:workspace"))],
    response_model=IngestReceipt,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["records"],
    summary="Upload a full patient record",
)
def upload_patient_record(payload: PatientRecordIn, session: Session = Depends(get_session),
                          request: Request = None):  # type: ignore[assignment]  # injected by FastAPI
    _note(request, f"patient {payload.id}")
    incoming = _aware(payload.updated_at)
    existing = session.get(PatientRecord, payload.id)
    if existing:
        stored = _aware(existing.updated_at)
        # A device that was offline for a day can reconnect and replay an old
        # copy. Accept the upload, but do not let it overwrite a newer one.
        if stored and incoming and incoming < stored:
            return IngestReceipt(accepted=True, id=payload.id, kind="patient", duplicate=True)
        for field, value in _record_columns(payload).items():
            setattr(existing, field, value)
        # This copy was accepted, so it arrived now. Only an applied update
        # moves this: a stale replay returned above without touching it, so
        # replaying old data cannot push a record back to the top of the
        # Data Inspector as though something just happened.
        existing.received_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        return IngestReceipt(accepted=True, id=payload.id, kind="patient", updated=True)
    session.add(PatientRecord(id=payload.id, **_record_columns(payload)))
    session.commit()
    return IngestReceipt(accepted=True, id=payload.id, kind="patient")


@app.post(
    "/api/v1/records/referrals",
    dependencies=[Depends(require("staff:workspace"))],
    response_model=IngestReceipt,
    status_code=status.HTTP_202_ACCEPTED,
    tags=["records"],
    summary="Upload a referral with its clinical payload",
)
def upload_care_referral(payload: CareReferralIn, session: Session = Depends(get_session),
                         request: Request = None):  # type: ignore[assignment]  # injected by FastAPI
    _note(request, f"referral {payload.id} for patient {payload.patient_id}")
    incoming = _aware(payload.updated_at)
    existing = session.get(CareReferral, payload.id)
    if existing:
        stored = _aware(existing.updated_at)
        if stored and incoming and incoming < stored:
            return IngestReceipt(accepted=True, id=payload.id, kind="referral", duplicate=True)
        for field, value in _referral_columns(payload).items():
            setattr(existing, field, value)
        # This copy was accepted, so it arrived now. Only an applied update
        # moves this: a stale replay returned above without touching it, so
        # replaying old data cannot push a record back to the top of the
        # Data Inspector as though something just happened.
        existing.received_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        return IngestReceipt(accepted=True, id=payload.id, kind="referral", updated=True)
    session.add(CareReferral(id=payload.id, **_referral_columns(payload)))
    session.commit()
    return IngestReceipt(accepted=True, id=payload.id, kind="referral")


@app.get(
    "/api/v1/records/incoming",
    dependencies=[Depends(require("referral:receive", facility_query="facility_id"))],
    response_model=IncomingList,
    tags=["records"],
    summary="Patients en route to a facility, for pre-arrival preparation",
)
def incoming_cases(
    facility_id: str = Query(..., description="The receiving facility"),
    session: Session = Depends(get_session),
    request: Request = None,  # type: ignore[assignment]  # injected by FastAPI
):
    # COMPLETED and CANCELLED are excluded: the point of this board is what is
    # still coming. A patient who has arrived belongs on the ward list instead.
    en_route = (
        session.exec(
            select(CareReferral)
            .where(CareReferral.to_facility_id == facility_id)
            .where(CareReferral.status.in_([
                ReferralStatus.INITIATED,
                ReferralStatus.ACCEPTED,
                ReferralStatus.IN_TRANSIT,
            ]))
        ).all()
    )
    # Most urgent first, then longest-waiting — the order a charge nurse reads in.
    priority_rank = {TriagePriority.RED: 0, TriagePriority.YELLOW: 1, TriagePriority.GREEN: 2}
    en_route.sort(key=lambda r: (priority_rank.get(r.priority, 3), _aware(r.raised_at) or datetime.min.replace(tzinfo=timezone.utc)))

    cases = []
    for ref in en_route:
        record = session.get(PatientRecord, ref.patient_id)
        cases.append(
            IncomingCase(
                referral=json.loads(ref.payload),
                patient=json.loads(record.payload) if record else None,
                eta_minutes=ref.eta_minutes,
                raised_at=ref.raised_at,
                priority=ref.priority,
                status=ref.status,
            )
        )
    _note(request, f"{len(cases)} incoming case(s): " + ", ".join(c.referral.get("patientId", "?") for c in cases)[:500])
    return IncomingList(facility_id=facility_id, count=len(cases), cases=cases)


@app.get(
    "/api/v1/store",
    dependencies=[Depends(require("data:inspect"))],
    response_model=StoreDump,
    tags=["records"],
    summary="Everything the record-sync store is holding, newest first",
)
def store_dump(
    limit: int = Query(50, ge=1, le=500, description="Rows per table"),
    session: Session = Depends(get_session),
):
    """
    A read-only window onto patient_records and care_referrals.

    This exists for the Data Inspector screen, whose job is to make the
    offline-to-cloud claim checkable rather than asserted: capture a patient
    with the network off, reconnect, and watch the same id appear here. A count
    on /health cannot do that — it proves a number changed, not that the record
    survived the trip intact — so the device's own payload is returned beside
    the projection columns the service indexes on.

    Newest first, by arrival at this service rather than by the device clock:
    the question this screen answers is "did what I just did land?", and device
    clocks in the field are not reliably set.

    SECURITY. This returns identified patient records, so it admits only the
    roles that hold data:inspect (the DHO and the Super Admin), and every call
    is written to the access log. The service still belongs on the facility or
    district network, behind TLS.
    """
    patient_total = session.exec(select(func.count()).select_from(PatientRecord)).one()
    referral_total = session.exec(select(func.count()).select_from(CareReferral)).one()

    patients = session.exec(
        select(PatientRecord).order_by(PatientRecord.received_at.desc()).limit(limit)
    ).all()
    referrals = session.exec(
        select(CareReferral).order_by(CareReferral.received_at.desc()).limit(limit)
    ).all()

    return StoreDump(
        generated_at=datetime.now(timezone.utc),
        limit=limit,
        patient_records_total=patient_total,
        patient_records_shown=len(patients),
        care_referrals_total=referral_total,
        care_referrals_shown=len(referrals),
        patient_records=[
            StoredPatient(
                id=r.id,
                name=r.name,
                age=r.age,
                gender=r.gender,
                facility_id=r.facility_id,
                triage_priority=r.triage_priority,
                updated_at=r.updated_at,
                received_at=r.received_at,
                payload=json.loads(r.payload),
            )
            for r in patients
        ],
        care_referrals=[
            StoredReferral(
                id=r.id,
                patient_id=r.patient_id,
                from_facility_id=r.from_facility_id,
                to_facility_id=r.to_facility_id,
                status=r.status,
                priority=r.priority,
                reason=r.reason,
                eta_minutes=r.eta_minutes,
                raised_at=r.raised_at,
                updated_at=r.updated_at,
                received_at=r.received_at,
                payload=json.loads(r.payload),
            )
            for r in referrals
        ],
    )

# ────────────────────────────── reporting ──────────────────────────────

@app.get(
    "/api/v1/access-log",
    dependencies=[Depends(require("audit:view"))],
    response_model=AccessLogPage,
    tags=["records"],
    summary="Who read or uploaded identified records, newest first",
)
def access_log_page(
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[str] = Query(None, description="Only this user's requests"),
    session: Session = Depends(get_session),
):
    query = select(AccessLog).order_by(AccessLog.id.desc()).limit(limit)
    if user_id:
        query = query.where(AccessLog.user_id == user_id)
    rows = session.exec(query).all()
    return AccessLogPage(
        count=len(rows),
        entries=[AccessLogEntry(**row.model_dump(exclude={"id"})) for row in rows],
    )


@app.get(
    "/api/v1/district/summary",
    dependencies=[Depends(require("analytics:view"))],
    response_model=DistrictSummary,
    tags=["reporting"],
    summary="District-wide totals for a rolling window",
)
def district_summary(
    days: int = Query(7, ge=1, le=365, description="Rolling window in days"),
    session: Session = Depends(get_session),
):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    encounters = session.exec(select(Encounter).where(Encounter.occurred_at >= since)).all()
    referrals = session.exec(select(Referral).where(Referral.raised_at >= since)).all()
    facilities = session.exec(select(Facility)).all()

    beds_total = sum(f.beds_total for f in facilities)
    beds_occupied = sum(f.beds_occupied for f in facilities)

    transit = [r.transit_minutes for r in referrals if r.transit_minutes is not None]

    return DistrictSummary(
        window_days=days,
        facilities_reporting=len(facilities),
        encounters=len(encounters),
        triage=TriageBreakdown(
            red=sum(1 for e in encounters if e.priority == TriagePriority.RED),
            yellow=sum(1 for e in encounters if e.priority == TriagePriority.YELLOW),
            green=sum(1 for e in encounters if e.priority == TriagePriority.GREEN),
        ),
        maternal_encounters=sum(1 for e in encounters if e.is_maternal),
        under_five_encounters=sum(1 for e in encounters if e.is_under_five),
        referrals_raised=len(referrals),
        referrals_completed=sum(1 for r in referrals if r.status == ReferralStatus.COMPLETED),
        # None, not zero, when nothing was dispatched — the same rule the app follows.
        median_transit_minutes=(sorted(transit)[len(transit) // 2] if transit else None),
        bed_occupancy_pct=(round(beds_occupied / beds_total * 100, 1) if beds_total else None),
        tiers=[
            TierBreakdown(
                tier=t,
                facilities=sum(1 for f in facilities if f.tier == t),
                encounters=sum(
                    1 for e in encounters
                    if any(f.id == e.facility_id and f.tier == t for f in facilities)
                ),
            )
            for t in FacilityTier
        ],
    )


@app.get(
    "/api/v1/facilities/{facility_id}/scorecard",
    dependencies=[Depends(require("analytics:view"))],
    response_model=FacilityScorecard,
    tags=["reporting"],
    summary="Per-facility scorecard",
)
def facility_scorecard(
    facility_id: str,
    days: int = Query(30, ge=1, le=365),
    session: Session = Depends(get_session),
):
    facility = session.get(Facility, facility_id)
    if not facility:
        raise HTTPException(404, f"No facility '{facility_id}'")

    since = datetime.now(timezone.utc) - timedelta(days=days)
    encounters = session.exec(
        select(Encounter).where(
            Encounter.facility_id == facility_id, Encounter.occurred_at >= since
        )
    ).all()
    outbound = session.exec(
        select(Referral).where(
            Referral.from_facility_id == facility_id, Referral.raised_at >= since
        )
    ).all()

    return FacilityScorecard(
        facility_id=facility.id,
        name=facility.name,
        tier=facility.tier,
        window_days=days,
        encounters=len(encounters),
        red_cases=sum(1 for e in encounters if e.priority == TriagePriority.RED),
        referrals_out=len(outbound),
        # A facility handling more locally refers less — the useful signal here.
        referral_rate_pct=(
            round(len(outbound) / len(encounters) * 100, 1) if encounters else None
        ),
        bed_occupancy_pct=(
            round(facility.beds_occupied / facility.beds_total * 100, 1)
            if facility.beds_total else None
        ),
        last_reported_at=facility.last_reported_at,
    )


@app.get(
    "/api/v1/facilities",
    dependencies=[Depends(require("staff:workspace"))],
    tags=["reporting"],
    summary="All reporting facilities",
)
def list_facilities(
    tier: Optional[FacilityTier] = None,
    session: Session = Depends(get_session),
):
    stmt = select(Facility)
    if tier:
        stmt = stmt.where(Facility.tier == tier)
    facilities = session.exec(stmt).all()
    return {"count": len(facilities), "facilities": facilities}
