"""
Relational models for the district reporting service.

The first group mirrors only what a District Health Officer needs for
aggregate reporting — counts, tiers, triage outcomes, referral throughput —
and holds no identifiers. The second (patient_records, care_referrals) holds
identified records on purpose, for one job: the receiving facility's
pre-arrival board; see the note above those tables. access_log records who
read or uploaded them.
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


# ─────────────────────── clinical records (pre-arrival) ───────────────────────
#
# Everything above this line is deliberately de-identified: the district gets
# counts, not people. The two tables below break that rule on purpose, and only
# for one job — letting a receiving facility prepare before a patient arrives.
#
# A referral is useless to the receiving team without the record it refers to,
# so the full record travels. The trade is explicit: identifiable health data
# now rests in this store, which is why every route to it needs a relay-signed
# session token with the right role, every access is logged (access_log), and
# the service should run behind TLS on the facility or district network.
#
# The record itself is held as a JSON payload rather than exploded into columns.
# The device schema is the clinical source of truth and evolves with the app; a
# mirrored column set here would silently drop fields the moment the two drift.
# Columns exist only for what this service actually queries on.


class PatientRecord(SQLModel, table=True):
    """A patient record as the capturing device holds it."""

    __tablename__ = "patient_records"

    id: str = Field(primary_key=True)
    facility_id: Optional[str] = Field(default=None, index=True)
    name: str
    # Fractional, so an under-5 recorded as 1.5 years is stored, not rejected.
    age: float
    gender: str
    triage_priority: Optional[TriagePriority] = Field(default=None, index=True)
    # Device clock, used for last-write-wins. Not authoritative for ordering
    # against other devices — it only decides whether an arriving copy of THIS
    # record is newer than the stored one.
    updated_at: datetime = Field(index=True)
    payload: str = Field(description="Full record as JSON, exactly as the device holds it")
    # When this service last ACCEPTED a copy, refreshed on every applied
    # update. Server clock, unlike updated_at, so it is the one field that
    # orders records from different devices against each other — which is
    # what the Data Inspector sorts on.
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CareReferral(SQLModel, table=True):
    """
    A referral with its clinical payload — the pre-arrival packet.

    Distinct from Referral above, which is the anonymous throughput row the
    district reports on. This one names the patient so the receiving team can
    pull the record and prepare.
    """

    __tablename__ = "care_referrals"

    id: str = Field(primary_key=True)
    patient_id: str = Field(index=True)
    from_facility_id: str = Field(index=True)
    to_facility_id: str = Field(index=True)
    status: ReferralStatus = Field(index=True)
    priority: TriagePriority = Field(index=True)
    reason: Optional[str] = None
    clinical_summary: Optional[str] = None
    transport_mode: Optional[str] = None
    eta_minutes: Optional[int] = None
    raised_at: datetime = Field(index=True)
    updated_at: datetime = Field(index=True)
    payload: str = Field(description="Full referral as JSON, exactly as the device holds it")
    # See PatientRecord.received_at — same rule.
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ───────────────────────────── accountability ─────────────────────────────


class AccessLog(SQLModel, table=True):
    """
    Who touched identified records, and when — including who was refused.

    Every /api/v1 request except the assistant and the health probe lands
    here (app/main.py, access-log middleware): the signed-in user, role and
    posting from their session token, what they asked for and what they were
    told. Uploads add the record they carried. It answers the question a data
    protection review starts with — who has seen this patient's record — and
    a refused request from a valid token is exactly the probing it should
    show. Read at GET /api/v1/access-log, by the roles that hold audit:view.
    """

    __tablename__ = "access_log"

    id: Optional[int] = Field(default=None, primary_key=True)
    at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    role: Optional[str] = None
    facility_id: Optional[str] = None
    method: str
    path: str = Field(index=True)
    query: Optional[str] = None
    status: int
    detail: Optional[str] = None
    client: Optional[str] = None
