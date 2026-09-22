"""
Relational models for the district reporting service.

These deliberately mirror only what a District Health Officer needs for
aggregate reporting — counts, tiers, triage outcomes, referral throughput.
They are NOT a copy of the clinical record. Free-text complaints, vitals and
identifiers stay on the facility device that captured them; centralising those
would undo the privacy property of the device-first design.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class FacilityTier(str, Enum):
    SC = "SC"
    PHC = "PHC"
    CHC = "CHC"
    SDH = "SDH"
    DH = "DH"


class TriagePriority(str, Enum):
    RED = "RED"
    YELLOW = "YELLOW"
    GREEN = "GREEN"


class ReferralStatus(str, Enum):
    INITIATED = "INITIATED"
    ACCEPTED = "ACCEPTED"
    IN_TRANSIT = "IN_TRANSIT"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Facility(SQLModel, table=True):
    """A facility that reports into the district."""

    __tablename__ = "facilities"

    id: str = Field(primary_key=True)
    name: str
    tier: FacilityTier
    block: Optional[str] = None
    beds_total: int = 0
    beds_occupied: int = 0
    last_reported_at: Optional[datetime] = None


class Encounter(SQLModel, table=True):
    """
    One clinical encounter, reduced to its reportable facts.

    Note what is absent: no patient name, no ABHA id, no vitals, no complaint.
    The district needs to know that a RED case was seen at a PHC on a date — it
    does not need to know who the patient was.
    """

    __tablename__ = "encounters"

    id: str = Field(primary_key=True)
    facility_id: str = Field(foreign_key="facilities.id", index=True)
    occurred_at: datetime = Field(index=True)
    priority: TriagePriority = Field(index=True)
    age_band: Optional[str] = Field(default=None, description="e.g. '0-5', '18-45'")
    is_maternal: bool = False
    is_under_five: bool = False
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Referral(SQLModel, table=True):
    """A transfer between tiers, for throughput and delay reporting."""

    __tablename__ = "referrals"

    id: str = Field(primary_key=True)
    from_facility_id: str = Field(foreign_key="facilities.id", index=True)
    to_facility_id: str = Field(foreign_key="facilities.id", index=True)
    status: ReferralStatus = Field(index=True)
    priority: TriagePriority
    raised_at: datetime = Field(index=True)
    dispatched_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def transit_minutes(self) -> Optional[float]:
        """
        Elapsed transit, or None where no real dispatch was recorded.

        Mirrors the rule the mobile app follows: a referral with no dispatch
        timestamp shows no clock rather than a fabricated elapsed time.
        """
        if not self.dispatched_at:
            return None
        end = self.completed_at or datetime.now(timezone.utc)
        return round((end - self.dispatched_at).total_seconds() / 60, 1)
