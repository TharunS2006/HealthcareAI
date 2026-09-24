"""
Role checks for the district service — the same rules the app and the mesh
relay apply, read from the table exported from lib/auth/permissions.ts
(backend/app/permissions.json; regenerate with `npm run export:permissions`).

Identity arrives as headers the app sends from the signed-in session:

    x-nalammesh-user      the staff user id
    x-nalammesh-role      ANM, MO, HOSPITAL_ADMIN, SPECIALIST, DHO or SUPER_ADMIN
    x-nalammesh-facility  their posting (absent for district and system roles)

This is mock identity — claimed, not verified — so these checks decide what a
role may do, not who the caller really is. A production deployment replaces
`_identity` with token verification and keeps every `require(...)` unchanged.

Checks are attached as route dependencies (`dependencies=[...]`), not as
function parameters, so the endpoint functions keep their signatures and the
verify scripts that call them directly still work.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from fastapi import HTTPException, Request, status

_TABLE = json.loads((Path(__file__).parent / "permissions.json").read_text())
ROLE_PERMISSIONS: dict[str, set[str]] = {role: set(perms) for role, perms in _TABLE["roles"].items()}
DISTRICT_WIDE: set[str] = set(_TABLE["district_wide"])


@dataclass(frozen=True)
class Identity:
    user_id: str
    role: str
    facility_id: Optional[str]


def _identity(request: Request) -> Optional[Identity]:
    user = request.headers.get("x-nalammesh-user")
    role = request.headers.get("x-nalammesh-role")
    if not user or role not in ROLE_PERMISSIONS:
        return None
    return Identity(user_id=user, role=role, facility_id=request.headers.get("x-nalammesh-facility") or None)


def require(permission: str, *, facility_query: Optional[str] = None) -> Callable[[Request], Identity]:
    """
    A dependency that admits only roles holding `permission`.

    With `facility_query`, the request's query parameter of that name must be
    the caller's own facility unless their role is district-wide — a PHC reads
    its own pre-arrival board, not the District Hospital's.
    """

    def dependency(request: Request) -> Identity:
        who = _identity(request)
        if who is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Send x-nalammesh-user and x-nalammesh-role headers from a signed-in session",
            )
        if permission not in ROLE_PERMISSIONS[who.role]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{who.role} does not hold {permission}",
            )
        if facility_query and who.role not in DISTRICT_WIDE:
            requested = request.query_params.get(facility_query)
            if requested and requested != who.facility_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only your own facility's records are available to your role",
                )
        return who

    return dependency
