"""
Request and response contracts.

Kept separate from the table models so the wire format can evolve without
forcing a schema migration, and so FastAPI's generated OpenAPI docs describe
exactly what a caller should send.
"""

import os
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

# Imported for its side effect: backend/.env is loaded before the read below.
from . import env  # noqa: F401
from .models import FacilityTier, ReferralStatus, TriagePriority


def _positive_int_env(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, "").strip() or default)
    except ValueError:
        return default
    return value if value > 0 else default


MAX_CONTEXT_CHARS = _positive_int_env("CHAT_MAX_CONTEXT_CHARS", 32_000)


# ───────────────────────────── ingest ─────────────────────────────

class FacilityIn(BaseModel):
    id: str = Field(examples=["phc-block-a"])
    name: str = Field(examples=["Primary Health Centre, Bhamragad"])
    tier: FacilityTier = Field(examples=["PHC"])
    block: Optional[str] = Field(default=None, examples=["Bhamragad"])
    beds_total: int = Field(default=0, ge=0, examples=[10])
    beds_occupied: int = Field(default=0, ge=0, examples=[6])


class EncounterIn(BaseModel):
    """
    A reportable encounter. Note the absence of identifying fields — the district
    receives counts and categories, never who the patient was.
    """

    id: str = Field(examples=["enc-2026-09-22-0001"])
    facility_id: str = Field(examples=["phc-block-a"])
    occurred_at: datetime = Field(examples=["2026-09-22T09:30:00"])
    priority: TriagePriority = Field(examples=["RED"])
    age_band: Optional[str] = Field(default=None, examples=["18-45"])
    is_maternal: bool = Field(default=False, examples=[True])
    is_under_five: bool = Field(default=False, examples=[False])


class ReferralIn(BaseModel):
    id: str = Field(examples=["ref-2026-0891"])
    from_facility_id: str = Field(examples=["phc-block-a"])
    to_facility_id: str = Field(examples=["dh-district"])
    status: ReferralStatus = Field(examples=["IN_TRANSIT"])
    priority: TriagePriority = Field(examples=["RED"])
    raised_at: datetime = Field(examples=["2026-09-22T09:35:00"])
    dispatched_at: Optional[datetime] = Field(default=None, examples=["2026-09-22T09:50:00"])
    completed_at: Optional[datetime] = None


class IngestReceipt(BaseModel):
    accepted: bool
    id: str
    kind: str
    duplicate: bool = False
    updated: bool = False


# ───────────────────────────── reporting ─────────────────────────────

class TriageBreakdown(BaseModel):
    red: int
    yellow: int
    green: int


class TierBreakdown(BaseModel):
    tier: FacilityTier
    facilities: int
    encounters: int


class DistrictSummary(BaseModel):
    window_days: int
    facilities_reporting: int
    encounters: int
    triage: TriageBreakdown
    maternal_encounters: int
    under_five_encounters: int
    referrals_raised: int
    referrals_completed: int
    median_transit_minutes: Optional[float] = Field(
        default=None,
        description="None when no referral in the window recorded a real dispatch time.",
    )
    bed_occupancy_pct: Optional[float] = Field(
        default=None, description="None when no facility has reported bed capacity."
    )
    tiers: List[TierBreakdown]


# ───────────────────────────── chat assistant ─────────────────────────────

class ChatIn(BaseModel):
    """
    A health worker's question, plus the grounding brief the client rendered
    from its own facility/threshold/scheme data. The backend never has its own
    copy of that data — it only relays it to the model — so the brief is what
    keeps the cloud answer from drifting away from what the app itself says.
    """

    # The caps are what keep this endpoint from being a free model proxy: every
    # character here is a token billed to the department's key. The question
    # box in the widget stops at the same 1000; the brief the app renders is
    # about 8,300 characters for the seven-facility district, so 32,000 leaves
    # room for a larger facility list (CHAT_MAX_CONTEXT_CHARS raises it).
    question: str = Field(
        min_length=1, max_length=1000,
        examples=["Where do I refer a RED case if the CHC has no beds free?"],
    )
    context: str = Field(
        max_length=MAX_CONTEXT_CHARS,
        examples=["REFERRAL PATHWAY: SC → PHC → CHC → SDH → DH\n..."],
    )
    role: Optional[str] = Field(default=None, max_length=40, examples=["ASHA"])
    language: str = Field(default="en", pattern=r"^(en|hi|mr)$", examples=["en"])


class ChatOut(BaseModel):
    answer: str
    model: str


class FacilityScorecard(BaseModel):
    facility_id: str
    name: str
    tier: FacilityTier
    window_days: int
    encounters: int
    red_cases: int
    referrals_out: int
    referral_rate_pct: Optional[float] = Field(
        default=None, description="None when the facility reported no encounters."
    )
    bed_occupancy_pct: Optional[float] = None
    last_reported_at: Optional[datetime] = None


# ───────────────────────── clinical records (pre-arrival) ─────────────────────

class PatientRecordIn(BaseModel):
    """
    A full patient record, uploaded so a receiving facility can prepare.

    `payload` is the record verbatim from the device. The named fields beside it
    are a projection the service queries on — they are not a second source of
    truth, and on conflict the payload wins.
    """

    id: str = Field(examples=["pat-7f3a"])
    name: str = Field(examples=["Sunita Madavi"])
    # Float, not int: an infant's age is recorded in fractions of a year on the
    # device ("1.5y"), and paediatric emergencies are exactly the referrals this
    # service must not refuse. The value is a projection for querying — the
    # payload carries whatever the device holds.
    age: float = Field(ge=0, le=130, examples=[27, 1.5])
    gender: str = Field(examples=["F"])
    facility_id: Optional[str] = Field(default=None, examples=["phc-bhamragad"])
    triage_priority: Optional[TriagePriority] = Field(default=None, examples=["RED"])
    updated_at: datetime = Field(examples=["2026-09-23T09:30:00"])
    payload: dict = Field(description="The record as the device holds it")


class CareReferralIn(BaseModel):
    """A referral with enough clinical context for the receiving team to act on."""

    id: str = Field(examples=["ref-2026-0891"])
    patient_id: str = Field(examples=["pat-7f3a"])
    from_facility_id: str = Field(examples=["phc-bhamragad"])
    to_facility_id: str = Field(examples=["dh-district"])
    status: ReferralStatus = Field(examples=["IN_TRANSIT"])
    priority: TriagePriority = Field(examples=["RED"])
    reason: Optional[str] = Field(default=None, examples=["Severe pre-eclampsia"])
    clinical_summary: Optional[str] = Field(default=None)
    transport_mode: Optional[str] = Field(default=None, examples=["AMBULANCE_102"])
    eta_minutes: Optional[int] = Field(default=None, ge=0, examples=[14])
    raised_at: datetime = Field(examples=["2026-09-23T09:35:00"])
    updated_at: datetime = Field(examples=["2026-09-23T09:41:00"])
    payload: dict = Field(description="The referral as the device holds it")


class IncomingCase(BaseModel):
    """
    One patient en route to the querying facility.

    `patient` is None when the referral arrived before the record did — the two
    upload independently, and a half-arrived pair must still show the receiving
    team that someone is coming rather than being hidden until both land.
    """

    referral: dict
    patient: Optional[dict] = None
    eta_minutes: Optional[int] = None
    raised_at: datetime
    priority: TriagePriority
    status: ReferralStatus


class IncomingList(BaseModel):
    facility_id: str
    count: int
    cases: List[IncomingCase]


# ───────────────────────── store inspection ─────────────────────────
# Read-only views of the record-sync tables, for the Data Inspector screen.
#
# Every other reporting response is a rollup: counts, rates, a board filtered to
# one facility. This one is deliberately raw. Its whole job is to let somebody
# standing in front of the app confirm that the row they captured on a device
# with the network off is now sitting in the district store, byte for byte — a
# claim that a summary figure can never actually settle.


class StoredPatient(BaseModel):
    """One row of patient_records, with the device's own JSON alongside it."""

    id: str
    name: str
    age: float
    gender: str
    facility_id: Optional[str] = None
    triage_priority: Optional[TriagePriority] = None
    updated_at: datetime
    received_at: datetime
    # The projection columns above are what the service queries on; this is what
    # the device actually sent. Showing both is the point: it demonstrates that
    # nothing was reshaped in transit.
    payload: dict


class StoredReferral(BaseModel):
    """One row of care_referrals, with the device's own JSON alongside it."""

    id: str
    patient_id: str
    from_facility_id: str
    to_facility_id: str
    status: ReferralStatus
    priority: TriagePriority
    reason: Optional[str] = None
    eta_minutes: Optional[int] = None
    raised_at: datetime
    updated_at: datetime
    received_at: datetime
    payload: dict


class StoreDump(BaseModel):
    """
    What the district store is holding right now.

    `*_total` is the true table depth and `*_shown` is how many rows came back,
    so a truncated view reports itself instead of quietly looking like an empty
    or half-full store.
    """

    generated_at: datetime
    limit: int
    patient_records_total: int
    patient_records_shown: int
    care_referrals_total: int
    care_referrals_shown: int
    patient_records: List[StoredPatient]
    care_referrals: List[StoredReferral]


# ───────────────────────────── accountability ─────────────────────────────

class AccessLogEntry(BaseModel):
    at: datetime
    user_id: Optional[str] = None
    role: Optional[str] = None
    facility_id: Optional[str] = None
    method: str
    path: str
    query: Optional[str] = None
    status: int
    detail: Optional[str] = None
    client: Optional[str] = None


class AccessLogPage(BaseModel):
    count: int
    entries: List[AccessLogEntry]
