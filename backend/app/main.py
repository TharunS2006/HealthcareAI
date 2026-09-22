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

from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, SQLModel, create_engine, func, select

from .models import (Encounter, Facility, FacilityTier, Referral,
                     ReferralStatus, TriagePriority)
from .schemas import (DistrictSummary, EncounterIn, FacilityIn,
                      FacilityScorecard, IngestReceipt, ReferralIn,
                      TierBreakdown, TriageBreakdown)

DATABASE_URL = "sqlite:///./district.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


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


app = FastAPI(
    title="NalamMesh — District Reporting Service",
    description=__doc__,
    version="1.0.0",
    lifespan=lifespan,
    contact={"name": "District Health Office"},
)

# The clinical app and the relay run on other origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────────────── health ──────────────────────────────

@app.get("/health", tags=["service"], summary="Liveness and store depth")
def health(session: Session = Depends(get_session)):
    return {
        "status": "healthy",
        "facilities": session.exec(select(func.count()).select_from(Facility)).one(),
        "encounters": session.exec(select(func.count()).select_from(Encounter)).one(),
        "referrals": session.exec(select(func.count()).select_from(Referral)).one(),
        "note": "Reporting only. Clinical care does not depend on this service.",
    }


# ────────────────────────────── ingest ──────────────────────────────

@app.post(
    "/api/v1/facilities",
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


# ────────────────────────────── reporting ──────────────────────────────

@app.get(
    "/api/v1/district/summary",
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
