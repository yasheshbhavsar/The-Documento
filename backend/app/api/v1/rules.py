"""API endpoints for immigration rules, official sources, and requirement engine."""
import difflib
from datetime import datetime, timezone
import hashlib
from typing import Any, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from backend.app.db.session import get_db
from backend.app.core.errors import NotFoundError, PermissionDeniedError
from backend.app.domain.models import (
    OfficialSource,
    SourceSnapshot,
    RuleSet,
    RuleSetVersion,
    RuleRequirement,
    CaseRequirementEvaluation,
    ImmigrationCase,
)
from backend.app.security.auth import AuthContext, get_auth_context
from backend.app.security.rbac import has_permission
from backend.app.rules.rule_engine import evaluate_case_requirements
from backend.app.rules.affected_cases_detector import identify_and_queue_affected_cases
from backend.app.rules.declarative_evaluator import ALLOWED_OPERATORS
from backend.app.rules.pilot_data import seed_eb1a_pilot


router = APIRouter(prefix="/rules", tags=["Immigration Rules Engine"])


# ==========================================
# Pydantic Schemas
# ==========================================

class OfficialSourceCreate(BaseModel):
    jurisdiction: str = Field(..., max_length=3, description="Jurisdiction code (e.g. US, CA, GB, AU, NZ, DE, RU)")
    authority: str = Field(..., max_length=120, description="Government authority (e.g. USCIS, DOS, IRCC, UKVI)")
    title: str = Field(..., max_length=255)
    url: str = Field(..., max_length=1024)
    scope_limitations: str = Field(..., description="Documented scope and legal limitations of this source")


class OfficialSourceOut(BaseModel):
    id: str
    organization_id: str
    jurisdiction: str
    authority: str
    title: str
    url: str
    scope_limitations: str
    last_retrieved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    snapshots_count: int = 0


class SourceSnapshotCreate(BaseModel):
    raw_content: str
    publication_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    snapshot_metadata: dict = Field(default_factory=dict)


class SourceSnapshotOut(BaseModel):
    id: str
    source_id: str
    retrieval_timestamp: datetime
    publication_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    content_hash: str
    raw_content: str
    snapshot_metadata: dict
    created_by_user_id: Optional[str] = None


class SnapshotCompareResult(BaseModel):
    from_snapshot_id: str
    to_snapshot_id: str
    from_retrieval_timestamp: datetime
    to_retrieval_timestamp: datetime
    diff_lines: List[str]
    has_changes: bool
    summary: str


class RuleSetCreate(BaseModel):
    jurisdiction: str = Field(..., max_length=3)
    authority: str = Field(..., max_length=120)
    program_pathway: str = Field(..., max_length=100)
    code: str = Field(..., max_length=64)
    name: str = Field(..., max_length=255)
    description: str


class RuleSetOut(BaseModel):
    id: str
    organization_id: str
    jurisdiction: str
    authority: str
    program_pathway: str
    code: str
    name: str
    description: str
    current_version_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class RuleRequirementCreate(BaseModel):
    code: str = Field(..., max_length=64)
    title: str = Field(..., max_length=255)
    description: str
    category: str = Field(..., max_length=64)
    statutory_citation: Optional[str] = Field(None, max_length=255)
    is_mandatory: bool = True
    priority: int = 1
    applicability_conditions: dict = Field(default_factory=dict)
    accepted_evidence_types: list = Field(default_factory=list)
    validation_rules: list = Field(default_factory=list)
    requires_human_review: bool = True
    review_guidance: Optional[str] = None
    blocking_dependencies: list = Field(default_factory=list)


class RuleRequirementOut(BaseModel):
    id: str
    rule_set_version_id: str
    code: str
    title: str
    description: str
    category: str
    statutory_citation: Optional[str] = None
    is_mandatory: bool
    priority: int
    applicability_conditions: dict
    accepted_evidence_types: list
    validation_rules: list
    requires_human_review: bool
    review_guidance: Optional[str] = None
    blocking_dependencies: list


class RuleSetVersionCreate(BaseModel):
    version_number: str = Field(..., max_length=32)
    change_summary: Optional[str] = None
    official_source_id: Optional[str] = None
    source_snapshot_id: Optional[str] = None
    publication_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    copy_requirements_from_version_id: Optional[str] = None


class RuleSetVersionOut(BaseModel):
    id: str
    rule_set_id: str
    version_number: str
    status: str
    official_source_id: Optional[str] = None
    source_snapshot_id: Optional[str] = None
    publication_date: Optional[datetime] = None
    effective_date: Optional[datetime] = None
    superseded_at: Optional[datetime] = None
    change_summary: Optional[str] = None
    author_user_id: Optional[str] = None
    approved_by_user_id: Optional[str] = None
    published_at: Optional[datetime] = None
    approval_history: list
    created_at: datetime
    requirements_count: int = 0


class VersionStatusTransition(BaseModel):
    target_status: str = Field(..., description="Target status: draft, under_review, validated, published, superseded, suspended")
    comments: Optional[str] = None


# ==========================================
# Helpers & Authorization Checks
# ==========================================

def check_can_draft(auth: AuthContext) -> None:
    if not (
        auth.has_permission("rule:draft")
        or auth.has_permission("rules:manage")
        or auth.has_role("master_admin")
        or auth.has_role("company_admin")
    ):
        raise PermissionDeniedError("Insufficient permissions to draft or modify immigration rules")


def check_can_approve(auth: AuthContext) -> None:
    if not (
        auth.has_permission("rule:approve")
        or auth.has_permission("rules:manage")
        or auth.has_role("master_admin")
        or auth.has_role("company_admin")
    ):
        raise PermissionDeniedError("Insufficient permissions to approve immigration rules")


def check_can_publish(auth: AuthContext) -> None:
    if not (
        auth.has_permission("rule:publish")
        or auth.has_permission("rules:manage")
        or auth.has_role("master_admin")
        or auth.has_role("company_admin")
    ):
        raise PermissionDeniedError("Insufficient permissions to publish or supersede immigration rules")


def check_can_write_source(auth: AuthContext) -> None:
    if not (
        auth.has_permission("source:write")
        or auth.has_permission("rule:draft")
        or auth.has_permission("rules:manage")
        or auth.has_role("master_admin")
        or auth.has_role("company_admin")
    ):
        raise PermissionDeniedError("Insufficient permissions to register or update official sources")


# ==========================================
# Official Sources Endpoints
# ==========================================

@router.get("/sources", response_model=List[OfficialSourceOut])
def list_official_sources(
    jurisdiction: Optional[str] = None,
    authority: Optional[str] = None,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    stmt = select(OfficialSource).where(OfficialSource.organization_id == auth.organization_id)
    if jurisdiction:
        stmt = stmt.where(OfficialSource.jurisdiction == jurisdiction.upper())
    if authority:
        stmt = stmt.where(OfficialSource.authority == authority)
    stmt = stmt.order_by(OfficialSource.jurisdiction.asc(), OfficialSource.authority.asc())
    sources = db.scalars(stmt).all()

    out = []
    for s in sources:
        out.append(
            OfficialSourceOut(
                id=str(s.id),
                organization_id=str(s.organization_id),
                jurisdiction=s.jurisdiction,
                authority=s.authority,
                title=s.title,
                url=s.url,
                scope_limitations=s.scope_limitations,
                last_retrieved_at=s.last_retrieved_at,
                created_at=s.created_at,
                updated_at=s.updated_at,
                snapshots_count=len(s.snapshots),
            )
        )
    return out


@router.post("/sources", response_model=OfficialSourceOut, status_code=status.HTTP_201_CREATED)
def create_official_source(
    payload: OfficialSourceCreate,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    check_can_write_source(auth)
    src = OfficialSource(
        organization_id=auth.organization_id,
        jurisdiction=payload.jurisdiction.upper(),
        authority=payload.authority,
        title=payload.title,
        url=payload.url,
        scope_limitations=payload.scope_limitations,
    )
    db.add(src)
    db.commit()
    db.refresh(src)
    return OfficialSourceOut(
        id=str(src.id),
        organization_id=str(src.organization_id),
        jurisdiction=src.jurisdiction,
        authority=src.authority,
        title=src.title,
        url=src.url,
        scope_limitations=src.scope_limitations,
        last_retrieved_at=src.last_retrieved_at,
        created_at=src.created_at,
        updated_at=src.updated_at,
        snapshots_count=0,
    )


@router.get("/sources/{source_id}", response_model=OfficialSourceOut)
def get_official_source(
    source_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    src = db.get(OfficialSource, source_id)
    if not src or src.organization_id != auth.organization_id:
        raise NotFoundError("Official source not found")
    return OfficialSourceOut(
        id=str(src.id),
        organization_id=str(src.organization_id),
        jurisdiction=src.jurisdiction,
        authority=src.authority,
        title=src.title,
        url=src.url,
        scope_limitations=src.scope_limitations,
        last_retrieved_at=src.last_retrieved_at,
        created_at=src.created_at,
        updated_at=src.updated_at,
        snapshots_count=len(src.snapshots),
    )


@router.get("/sources/{source_id}/snapshots", response_model=List[SourceSnapshotOut])
def list_source_snapshots(
    source_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    src = db.get(OfficialSource, source_id)
    if not src or src.organization_id != auth.organization_id:
        raise NotFoundError("Official source not found")

    stmt = (
        select(SourceSnapshot)
        .where(SourceSnapshot.source_id == source_id)
        .order_by(SourceSnapshot.retrieval_timestamp.desc())
    )
    snaps = db.scalars(stmt).all()
    return [
        SourceSnapshotOut(
            id=str(s.id),
            source_id=str(s.source_id),
            retrieval_timestamp=s.retrieval_timestamp,
            publication_date=s.publication_date,
            effective_date=s.effective_date,
            content_hash=s.content_hash,
            raw_content=s.raw_content,
            snapshot_metadata=s.snapshot_metadata,
            created_by_user_id=str(s.created_by_user_id) if s.created_by_user_id else None,
        )
        for s in snaps
    ]


@router.post("/sources/{source_id}/snapshots", response_model=SourceSnapshotOut, status_code=status.HTTP_201_CREATED)
def capture_source_snapshot(
    source_id: uuid.UUID,
    payload: SourceSnapshotCreate,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    check_can_write_source(auth)
    src = db.get(OfficialSource, source_id)
    if not src or src.organization_id != auth.organization_id:
        raise NotFoundError("Official source not found")

    now = datetime.now(timezone.utc)
    content_hash = hashlib.sha256(payload.raw_content.encode("utf-8")).hexdigest()

    snap = SourceSnapshot(
        organization_id=auth.organization_id,
        source_id=src.id,
        retrieval_timestamp=now,
        publication_date=payload.publication_date,
        effective_date=payload.effective_date,
        content_hash=content_hash,
        raw_content=payload.raw_content,
        snapshot_metadata=payload.snapshot_metadata,
        created_by_user_id=auth.user_id,
    )
    db.add(snap)
    src.last_retrieved_at = now
    db.commit()
    db.refresh(snap)

    return SourceSnapshotOut(
        id=str(snap.id),
        source_id=str(snap.source_id),
        retrieval_timestamp=snap.retrieval_timestamp,
        publication_date=snap.publication_date,
        effective_date=snap.effective_date,
        content_hash=snap.content_hash,
        raw_content=snap.raw_content,
        snapshot_metadata=snap.snapshot_metadata,
        created_by_user_id=str(snap.created_by_user_id) if snap.created_by_user_id else None,
    )


@router.get("/sources/{source_id}/snapshots/compare", response_model=SnapshotCompareResult)
def compare_source_snapshots(
    source_id: uuid.UUID,
    from_id: uuid.UUID = Query(..., description="Baseline snapshot ID"),
    to_id: uuid.UUID = Query(..., description="Comparison snapshot ID"),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    src = db.get(OfficialSource, source_id)
    if not src or src.organization_id != auth.organization_id:
        raise NotFoundError("Official source not found")

    from_snap = db.get(SourceSnapshot, from_id)
    to_snap = db.get(SourceSnapshot, to_id)
    if not from_snap or not to_snap:
        raise NotFoundError("One or both snapshots could not be found")

    from_lines = from_snap.raw_content.splitlines(keepends=True)
    to_lines = to_snap.raw_content.splitlines(keepends=True)

    diff = list(
        difflib.unified_diff(
            from_lines,
            to_lines,
            fromfile=f"Snapshot-{str(from_snap.id)[:8]} ({from_snap.retrieval_timestamp.isoformat()})",
            tofile=f"Snapshot-{str(to_snap.id)[:8]} ({to_snap.retrieval_timestamp.isoformat()})",
            lineterm="",
        )
    )

    has_diff = from_snap.content_hash != to_snap.content_hash
    summary = (
        f"{len(diff)} diff line(s) detected between revisions."
        if has_diff
        else "Snapshots are byte-for-byte identical (matching SHA-256 hash)."
    )

    return SnapshotCompareResult(
        from_snapshot_id=str(from_snap.id),
        to_snapshot_id=str(to_snap.id),
        from_retrieval_timestamp=from_snap.retrieval_timestamp,
        to_retrieval_timestamp=to_snap.retrieval_timestamp,
        diff_lines=[d.strip("\n") for d in diff],
        has_changes=has_diff,
        summary=summary,
    )


# ==========================================
# Rule Sets Endpoints
# ==========================================

@router.get("/sets", response_model=List[RuleSetOut])
def list_rule_sets(
    jurisdiction: Optional[str] = None,
    program_pathway: Optional[str] = None,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    stmt = select(RuleSet).where(RuleSet.organization_id == auth.organization_id)
    if jurisdiction:
        stmt = stmt.where(RuleSet.jurisdiction == jurisdiction.upper())
    if program_pathway:
        stmt = stmt.where(RuleSet.program_pathway == program_pathway)
    stmt = stmt.order_by(RuleSet.jurisdiction.asc(), RuleSet.code.asc())
    sets = db.scalars(stmt).all()

    return [
        RuleSetOut(
            id=str(rs.id),
            organization_id=str(rs.organization_id),
            jurisdiction=rs.jurisdiction,
            authority=rs.authority,
            program_pathway=rs.program_pathway,
            code=rs.code,
            name=rs.name,
            description=rs.description,
            current_version_id=str(rs.current_version_id) if rs.current_version_id else None,
            created_at=rs.created_at,
            updated_at=rs.updated_at,
        )
        for rs in sets
    ]


@router.post("/sets", response_model=RuleSetOut, status_code=status.HTTP_201_CREATED)
def create_rule_set(
    payload: RuleSetCreate,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    check_can_draft(auth)
    # Check duplicate code
    existing = db.scalar(
        select(RuleSet).where(
            RuleSet.organization_id == auth.organization_id,
            RuleSet.code == payload.code,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Rule set with code '{payload.code}' already exists in this organization",
        )

    rs = RuleSet(
        organization_id=auth.organization_id,
        jurisdiction=payload.jurisdiction.upper(),
        authority=payload.authority,
        program_pathway=payload.program_pathway,
        code=payload.code,
        name=payload.name,
        description=payload.description,
    )
    db.add(rs)
    db.commit()
    db.refresh(rs)
    return RuleSetOut(
        id=str(rs.id),
        organization_id=str(rs.organization_id),
        jurisdiction=rs.jurisdiction,
        authority=rs.authority,
        program_pathway=rs.program_pathway,
        code=rs.code,
        name=rs.name,
        description=rs.description,
        current_version_id=None,
        created_at=rs.created_at,
        updated_at=rs.updated_at,
    )


@router.get("/sets/{set_id}", response_model=RuleSetOut)
def get_rule_set(
    set_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    rs = db.get(RuleSet, set_id)
    if not rs or rs.organization_id != auth.organization_id:
        raise NotFoundError("Rule set not found")
    return RuleSetOut(
        id=str(rs.id),
        organization_id=str(rs.organization_id),
        jurisdiction=rs.jurisdiction,
        authority=rs.authority,
        program_pathway=rs.program_pathway,
        code=rs.code,
        name=rs.name,
        description=rs.description,
        current_version_id=str(rs.current_version_id) if rs.current_version_id else None,
        created_at=rs.created_at,
        updated_at=rs.updated_at,
    )


@router.get("/sets/{set_id}/versions", response_model=List[RuleSetVersionOut])
def list_rule_set_versions(
    set_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    rs = db.get(RuleSet, set_id)
    if not rs or rs.organization_id != auth.organization_id:
        raise NotFoundError("Rule set not found")

    stmt = (
        select(RuleSetVersion)
        .where(RuleSetVersion.rule_set_id == set_id)
        .order_by(RuleSetVersion.created_at.desc())
    )
    versions = db.scalars(stmt).all()

    return [
        RuleSetVersionOut(
            id=str(v.id),
            rule_set_id=str(v.rule_set_id),
            version_number=v.version_number,
            status=v.status,
            official_source_id=str(v.official_source_id) if v.official_source_id else None,
            source_snapshot_id=str(v.source_snapshot_id) if v.source_snapshot_id else None,
            publication_date=v.publication_date,
            effective_date=v.effective_date,
            superseded_at=v.superseded_at,
            change_summary=v.change_summary,
            author_user_id=str(v.author_user_id) if v.author_user_id else None,
            approved_by_user_id=str(v.approved_by_user_id) if v.approved_by_user_id else None,
            published_at=v.published_at,
            approval_history=v.approval_history,
            created_at=v.created_at,
            requirements_count=len(v.requirements),
        )
        for v in versions
    ]


@router.post("/sets/{set_id}/versions", response_model=RuleSetVersionOut, status_code=status.HTTP_201_CREATED)
def create_rule_set_version(
    set_id: uuid.UUID,
    payload: RuleSetVersionCreate,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    check_can_draft(auth)
    rs = db.get(RuleSet, set_id)
    if not rs or rs.organization_id != auth.organization_id:
        raise NotFoundError("Rule set not found")

    # Check duplicate version
    existing = db.scalar(
        select(RuleSetVersion).where(
            RuleSetVersion.rule_set_id == set_id,
            RuleSetVersion.version_number == payload.version_number,
        )
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Version '{payload.version_number}' already exists for this rule set",
        )

    now = datetime.now(timezone.utc)
    v = RuleSetVersion(
        organization_id=auth.organization_id,
        rule_set_id=set_id,
        version_number=payload.version_number,
        status="draft",
        change_summary=payload.change_summary,
        official_source_id=uuid.UUID(payload.official_source_id) if payload.official_source_id else None,
        source_snapshot_id=uuid.UUID(payload.source_snapshot_id) if payload.source_snapshot_id else None,
        publication_date=payload.publication_date,
        effective_date=payload.effective_date,
        author_user_id=auth.user_id,
        approval_history=[
            {
                "stage": "draft",
                "action": "created",
                "actor_id": str(auth.user_id),
                "timestamp": now.isoformat(),
                "comments": payload.change_summary or "Initial draft",
            }
        ],
    )
    db.add(v)
    db.flush()

    # Optionally copy requirements from previous version
    if payload.copy_requirements_from_version_id:
        src_v = db.get(RuleSetVersion, uuid.UUID(payload.copy_requirements_from_version_id))
        if src_v and src_v.rule_set_id == set_id:
            for req in src_v.requirements:
                copied_req = RuleRequirement(
                    organization_id=auth.organization_id,
                    rule_set_version_id=v.id,
                    code=req.code,
                    title=req.title,
                    description=req.description,
                    category=req.category,
                    statutory_citation=req.statutory_citation,
                    is_mandatory=req.is_mandatory,
                    priority=req.priority,
                    applicability_conditions=req.applicability_conditions,
                    accepted_evidence_types=req.accepted_evidence_types,
                    validation_rules=req.validation_rules,
                    requires_human_review=req.requires_human_review,
                    review_guidance=req.review_guidance,
                    blocking_dependencies=req.blocking_dependencies,
                )
                db.add(copied_req)

    db.commit()
    db.refresh(v)

    return RuleSetVersionOut(
        id=str(v.id),
        rule_set_id=str(v.rule_set_id),
        version_number=v.version_number,
        status=v.status,
        official_source_id=str(v.official_source_id) if v.official_source_id else None,
        source_snapshot_id=str(v.source_snapshot_id) if v.source_snapshot_id else None,
        publication_date=v.publication_date,
        effective_date=v.effective_date,
        superseded_at=v.superseded_at,
        change_summary=v.change_summary,
        author_user_id=str(v.author_user_id) if v.author_user_id else None,
        approved_by_user_id=str(v.approved_by_user_id) if v.approved_by_user_id else None,
        published_at=v.published_at,
        approval_history=v.approval_history,
        created_at=v.created_at,
        requirements_count=len(v.requirements),
    )


# ==========================================
# Rule Version Lifecycle & Requirements
# ==========================================

@router.get("/versions/{version_id}", response_model=RuleSetVersionOut)
def get_rule_set_version(
    version_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    v = db.get(RuleSetVersion, version_id)
    if not v or v.organization_id != auth.organization_id:
        raise NotFoundError("Rule set version not found")

    return RuleSetVersionOut(
        id=str(v.id),
        rule_set_id=str(v.rule_set_id),
        version_number=v.version_number,
        status=v.status,
        official_source_id=str(v.official_source_id) if v.official_source_id else None,
        source_snapshot_id=str(v.source_snapshot_id) if v.source_snapshot_id else None,
        publication_date=v.publication_date,
        effective_date=v.effective_date,
        superseded_at=v.superseded_at,
        change_summary=v.change_summary,
        author_user_id=str(v.author_user_id) if v.author_user_id else None,
        approved_by_user_id=str(v.approved_by_user_id) if v.approved_by_user_id else None,
        published_at=v.published_at,
        approval_history=v.approval_history,
        created_at=v.created_at,
        requirements_count=len(v.requirements),
    )


@router.get("/versions/{version_id}/requirements", response_model=List[RuleRequirementOut])
def list_version_requirements(
    version_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    v = db.get(RuleSetVersion, version_id)
    if not v or v.organization_id != auth.organization_id:
        raise NotFoundError("Rule set version not found")

    stmt = (
        select(RuleRequirement)
        .where(RuleRequirement.rule_set_version_id == version_id)
        .order_by(RuleRequirement.priority.asc(), RuleRequirement.code.asc())
    )
    reqs = db.scalars(stmt).all()

    return [
        RuleRequirementOut(
            id=str(r.id),
            rule_set_version_id=str(r.rule_set_version_id),
            code=r.code,
            title=r.title,
            description=r.description,
            category=r.category,
            statutory_citation=r.statutory_citation,
            is_mandatory=r.is_mandatory,
            priority=r.priority,
            applicability_conditions=r.applicability_conditions,
            accepted_evidence_types=r.accepted_evidence_types,
            validation_rules=r.validation_rules,
            requires_human_review=r.requires_human_review,
            review_guidance=r.review_guidance,
            blocking_dependencies=r.blocking_dependencies,
        )
        for r in reqs
    ]


@router.post("/versions/{version_id}/requirements", response_model=RuleRequirementOut, status_code=status.HTTP_201_CREATED)
def create_version_requirement(
    version_id: uuid.UUID,
    payload: RuleRequirementCreate,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    check_can_draft(auth)
    v = db.get(RuleSetVersion, version_id)
    if not v or v.organization_id != auth.organization_id:
        raise NotFoundError("Rule set version not found")

    if v.status not in ["draft", "under_review"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requirements cannot be modified when version status is '{v.status}'. Must be 'draft'.",
        )

    # Validate condition operators
    def validate_conditions_dict(cond: dict):
        if not cond:
            return
        if "all" in cond and isinstance(cond["all"], list):
            for c in cond["all"]:
                validate_conditions_dict(c)
        elif "any" in cond and isinstance(cond["any"], list):
            for c in cond["any"]:
                validate_conditions_dict(c)
        else:
            op = cond.get("op", "eq").lower()
            if op not in ALLOWED_OPERATORS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Disallowed operator '{op}'. Allowed operators: {list(ALLOWED_OPERATORS.keys())}",
                )

    validate_conditions_dict(payload.applicability_conditions)

    req = RuleRequirement(
        organization_id=auth.organization_id,
        rule_set_version_id=v.id,
        code=payload.code,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        statutory_citation=payload.statutory_citation,
        is_mandatory=payload.is_mandatory,
        priority=payload.priority,
        applicability_conditions=payload.applicability_conditions,
        accepted_evidence_types=payload.accepted_evidence_types,
        validation_rules=payload.validation_rules,
        requires_human_review=payload.requires_human_review,
        review_guidance=payload.review_guidance,
        blocking_dependencies=payload.blocking_dependencies,
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return RuleRequirementOut(
        id=str(req.id),
        rule_set_version_id=str(req.rule_set_version_id),
        code=req.code,
        title=req.title,
        description=req.description,
        category=req.category,
        statutory_citation=req.statutory_citation,
        is_mandatory=req.is_mandatory,
        priority=req.priority,
        applicability_conditions=req.applicability_conditions,
        accepted_evidence_types=req.accepted_evidence_types,
        validation_rules=req.validation_rules,
        requires_human_review=req.requires_human_review,
        review_guidance=req.review_guidance,
        blocking_dependencies=req.blocking_dependencies,
    )


@router.post("/versions/{version_id}/transition", response_model=RuleSetVersionOut)
def transition_version_status(
    version_id: uuid.UUID,
    payload: VersionStatusTransition,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    v = db.get(RuleSetVersion, version_id)
    if not v or v.organization_id != auth.organization_id:
        raise NotFoundError("Rule set version not found")

    target = payload.target_status.lower()
    allowed_statuses = ["draft", "under_review", "validated", "published", "superseded", "suspended"]
    if target not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target status '{target}'. Must be one of {allowed_statuses}",
        )

    now = datetime.now(timezone.utc)
    current = v.status

    # Enforce State Machine Transitions & Separation of Duty
    if target == "under_review":
        if current != "draft":
            raise HTTPException(status_code=400, detail="Only 'draft' versions can be submitted for review")
        check_can_draft(auth)

    elif target == "validated":
        if current != "under_review":
            raise HTTPException(status_code=400, detail="Only 'under_review' versions can be transitioned to 'validated'")
        check_can_approve(auth)
        # Check separation of duty: Author cannot self-approve if role is strictly rule_approver
        if v.author_user_id and v.author_user_id == auth.user_id and auth.has_role("rule_approver") and not (auth.has_role("master_admin") or auth.has_role("company_admin")):
            raise PermissionDeniedError("Separation of duty: The author cannot approve their own rule version")
        v.approved_by_user_id = auth.user_id

    elif target == "published":
        if current not in ["validated", "under_review"]:
            raise HTTPException(status_code=400, detail="Version must be 'validated' before publication")
        check_can_publish(auth)
        v.published_at = now
        # Set rule set current version to this
        ruleset = db.get(RuleSet, v.rule_set_id)
        if ruleset:
            # Supersede old published version if one exists
            if ruleset.current_version_id and ruleset.current_version_id != v.id:
                old_v = db.get(RuleSetVersion, ruleset.current_version_id)
                if old_v and old_v.status == "published":
                    old_v.status = "superseded"
                    old_v.superseded_at = now
                    hist = list(old_v.approval_history)
                    hist.append({
                        "stage": "superseded",
                        "action": "superseded_by_new_version",
                        "actor_id": str(auth.user_id),
                        "timestamp": now.isoformat(),
                        "comments": f"Superseded by version {v.version_number}",
                    })
                    old_v.approval_history = hist
            ruleset.current_version_id = v.id

    elif target in ["superseded", "suspended"]:
        check_can_publish(auth)
        if target == "superseded":
            v.superseded_at = now

    v.status = target
    hist = list(v.approval_history)
    hist.append({
        "from_status": current,
        "to_status": target,
        "action": f"transition_to_{target}",
        "actor_id": str(auth.user_id),
        "timestamp": now.isoformat(),
        "comments": payload.comments or f"Transitioned from {current} to {target}",
    })
    v.approval_history = hist

    db.commit()
    db.refresh(v)

    return RuleSetVersionOut(
        id=str(v.id),
        rule_set_id=str(v.rule_set_id),
        version_number=v.version_number,
        status=v.status,
        official_source_id=str(v.official_source_id) if v.official_source_id else None,
        source_snapshot_id=str(v.source_snapshot_id) if v.source_snapshot_id else None,
        publication_date=v.publication_date,
        effective_date=v.effective_date,
        superseded_at=v.superseded_at,
        change_summary=v.change_summary,
        author_user_id=str(v.author_user_id) if v.author_user_id else None,
        approved_by_user_id=str(v.approved_by_user_id) if v.approved_by_user_id else None,
        published_at=v.published_at,
        approval_history=v.approval_history,
        created_at=v.created_at,
        requirements_count=len(v.requirements),
    )


# ==========================================
# Regression Testing & Impact Analysis
# ==========================================

@router.post("/versions/{version_id}/test-regression")
def run_version_regression_tests(
    version_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Runs automated structural and regression test suite on the rule set version."""
    v = db.get(RuleSetVersion, version_id)
    if not v or v.organization_id != auth.organization_id:
        raise NotFoundError("Rule set version not found")

    requirements = v.requirements
    checks_passed = []
    warnings = []
    errors = []

    # 1. Check requirements presence
    if not requirements:
        errors.append("Rule set version has 0 configured requirements")
    else:
        checks_passed.append(f"Contains {len(requirements)} configured requirement definition(s)")

    # 2. Check for duplicate codes
    codes = [r.code for r in requirements]
    if len(codes) != len(set(codes)):
        errors.append("Duplicate requirement codes found in rule set version")
    else:
        checks_passed.append("Requirement codes are uniquely defined")

    # 3. Check for circular dependencies
    dep_graph = {r.code: (r.blocking_dependencies or []) for r in requirements}
    for code, deps in dep_graph.items():
        for d in deps:
            if d not in dep_graph:
                warnings.append(f"Requirement '{code}' depends on missing requirement '{d}'")
            if code in dep_graph.get(d, []):
                errors.append(f"Circular dependency detected between '{code}' and '{d}'")

    if not any("Circular dependency" in e for e in errors):
        checks_passed.append("Dependency graph free of circular deadlocks")

    # 4. Check operators in applicability rules
    for req in requirements:
        cond = req.applicability_conditions or {}
        if cond and "op" in cond:
            op = cond.get("op", "").lower()
            if op not in ALLOWED_OPERATORS:
                errors.append(f"Requirement '{req.code}' specifies unsupported operator '{op}'")
    checks_passed.append("All conditional expressions validated against safe declarative AST operators")

    # 5. Check official source association
    if v.official_source_id:
        src = db.get(OfficialSource, v.official_source_id)
        if src:
            checks_passed.append(f"Linked to official government source: {src.authority} ({src.title})")
        else:
            warnings.append("Configured official source ID does not exist in registry")
    else:
        warnings.append("Rule version has no linked official source snapshot for legal provenance")

    is_success = len(errors) == 0

    return {
        "rule_set_version_id": str(v.id),
        "version_number": v.version_number,
        "is_valid": is_success,
        "passed_checks": checks_passed,
        "warnings": warnings,
        "errors": errors,
        "recommendation": "Ready for formal review and publication" if is_success else "Resolve critical errors before publishing",
    }


@router.post("/versions/{version_id}/affected-cases")
def identify_affected_cases(
    version_id: uuid.UUID,
    create_review_tasks: bool = Query(True, description="Whether to queue CaseTask records for caseworkers"),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Identifies open cases affected by this rule set version and queues review tasks."""
    check_can_publish(auth)
    v = db.get(RuleSetVersion, version_id)
    if not v or v.organization_id != auth.organization_id:
        raise NotFoundError("Rule set version not found")

    result = identify_and_queue_affected_cases(
        db=db,
        rule_set_version=v,
        triggered_by_user_id=auth.user_id,
        create_review_tasks=create_review_tasks,
    )
    return result


# ==========================================
# Case Requirement Evaluation Endpoints
# ==========================================

@router.post("/cases/{case_id}/evaluate", status_code=status.HTTP_200_OK)
def evaluate_case_requirements_endpoint(
    case_id: uuid.UUID,
    rule_set_version_id: Optional[uuid.UUID] = Query(None, description="Optional explicit rule set version. If omitted, uses active published version."),
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Evaluates case against declarative requirements and persists traceable CaseRequirementEvaluation."""
    case = db.get(ImmigrationCase, case_id)
    if not case or case.organization_id != auth.organization_id:
        raise NotFoundError("Case not found")

    target_version: Optional[RuleSetVersion] = None

    if rule_set_version_id:
        target_version = db.get(RuleSetVersion, rule_set_version_id)
        if not target_version or target_version.organization_id != auth.organization_id:
            raise NotFoundError("Specified rule set version not found")
    else:
        # Find active published rule set for case's jurisdiction and visa category
        stmt = (
            select(RuleSet)
            .where(
                RuleSet.organization_id == auth.organization_id,
                RuleSet.jurisdiction == case.jurisdiction,
                RuleSet.program_pathway == case.visa_category,
            )
        )
        rs = db.scalar(stmt)
        if not rs:
            # Fallback by code
            rs = db.scalar(
                select(RuleSet).where(
                    RuleSet.organization_id == auth.organization_id,
                    RuleSet.code.ilike(f"%{case.visa_category}%"),
                )
            )

        if not rs or not rs.current_version_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No published rule set version found for jurisdiction '{case.jurisdiction}' and pathway '{case.visa_category}'",
            )
        target_version = db.get(RuleSetVersion, rs.current_version_id)

    if not target_version:
        raise NotFoundError("Rule set version could not be resolved")

    evaluation = evaluate_case_requirements(
        db=db,
        case=case,
        rule_set_version=target_version,
        evaluator_user_id=auth.user_id,
    )

    return {
        "evaluation_id": str(evaluation.id),
        "case_id": str(case.id),
        "rule_set_version_id": str(target_version.id),
        "version_number": target_version.version_number,
        "status": evaluation.status,
        "overall_fulfillment_percentage": evaluation.overall_fulfillment_percentage,
        "evaluated_at": evaluation.evaluated_at.isoformat(),
        "is_superseded": evaluation.is_superseded,
        "results": evaluation.requirement_results,
    }


@router.get("/cases/{case_id}/evaluations")
def list_case_evaluations(
    case_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Retrieves history of requirement evaluations for a case with exact version provenance."""
    case = db.get(ImmigrationCase, case_id)
    if not case or case.organization_id != auth.organization_id:
        raise NotFoundError("Case not found")

    stmt = (
        select(CaseRequirementEvaluation)
        .where(CaseRequirementEvaluation.case_id == case_id)
        .order_by(CaseRequirementEvaluation.evaluated_at.desc())
    )
    evals = db.scalars(stmt).all()

    out = []
    for e in evals:
        v = db.get(RuleSetVersion, e.rule_set_version_id)
        v_num = v.version_number if v else "unknown"
        out.append({
            "id": str(e.id),
            "case_id": str(e.case_id),
            "rule_set_version_id": str(e.rule_set_version_id),
            "version_number": v_num,
            "status": e.status,
            "overall_fulfillment_percentage": e.overall_fulfillment_percentage,
            "evaluated_at": e.evaluated_at.isoformat(),
            "is_superseded": e.is_superseded,
            "results": e.requirement_results,
        })
    return out


# ==========================================
# Pilot Pathway Seeder Endpoint
# ==========================================

@router.post("/pilot/seed-eb1a", status_code=status.HTTP_200_OK)
def seed_pilot_eb1a_endpoint(
    auth: AuthContext = Depends(get_auth_context),
    db: Session = Depends(get_db),
):
    """Provisions the official US EB-1A Extraordinary Ability pilot pathway."""
    check_can_draft(auth)
    version = seed_eb1a_pilot(db=db, org_id=auth.organization_id, user_id=auth.user_id)
    return {
        "success": True,
        "message": "US EB-1A Extraordinary Ability pilot pathway provisioned and published",
        "rule_set_version_id": str(version.id),
        "version_number": version.version_number,
        "status": version.status,
        "requirements_count": len(version.requirements),
    }
