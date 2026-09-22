"""
Request and response contracts.

Kept separate from the table models so the wire format can evolve without
forcing a schema migration, and so FastAPI's generated OpenAPI docs describe
exactly what a caller should send.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from .models import FacilityTier, ReferralStatus, TriagePriority


# ───────────────────────────── ingest ─────────────────────────────

class FacilityIn(BaseModel):
    id: str = Field(examples=["phc-block-a"])
    name: str = Field(examples=["Primary Health Centre — Block A"])
    tier: FacilityTier = Field(examples=["PHC"])
    block: Optional[str] = Field(default=None, examples=["Block A"])
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
