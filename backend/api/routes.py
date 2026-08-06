"""Projects, Chat, Reports, and Admin API routes."""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from core.database import get_db
from core.security import get_current_active_user, require_admin
from models.project import Project
from models.user import User
from models.review import Review, ChatMessage
from models.submission import CodeSubmission
from models.finding import Finding

# ─── Projects Router ──────────────────────────────────────────────
projects_router = APIRouter(prefix="/api/projects", tags=["Projects"])


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


@projects_router.post("/", status_code=201)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    project = Project(name=data.name, description=data.description, owner_id=current_user.id)
    db.add(project)
    await db.flush()
    await db.refresh(project)
    return {"id": project.id, "name": project.name, "description": project.description, "created_at": project.created_at.isoformat()}


@projects_router.get("/")
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Project).where(Project.owner_id == current_user.id))
    projects = result.scalars().all()
    return [{"id": p.id, "name": p.name, "description": p.description, "created_at": p.created_at.isoformat()} for p in projects]


# ─── Chat Router ──────────────────────────────────────────────────
chat_router = APIRouter(prefix="/api/chat", tags=["Conversational Assistant"])


class ChatRequest(BaseModel):
    review_id: str
    message: str


@chat_router.post("/")
async def chat(
    data: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    from rag.chat_agent import generate_chat_response

    # Get review context
    result = await db.execute(select(Review).where(Review.id == data.review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    # Get chat history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.review_id == data.review_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(20)
    )
    history = [{"role": m.role, "content": m.content} for m in history_result.scalars().all()]

    # Build review context dict
    review_context = {
        "code_analysis": json.loads(review.code_analysis_result or "{}"),
        "security_analysis": json.loads(review.security_analysis_result or "{}"),
        "remediation": json.loads(review.remediation_result or "{}"),
        "pr_summary": json.loads(review.pr_summary_result or "{}"),
        "stats": {
            "total_findings": review.total_findings,
            "quality_score": review.overall_score,
        },
    }

    # Generate AI response
    response_text = await generate_chat_response(data.message, review_context, history)

    # Save messages
    user_msg = ChatMessage(review_id=data.review_id, role="user", content=data.message)
    ai_msg = ChatMessage(review_id=data.review_id, role="assistant", content=response_text)
    db.add(user_msg)
    db.add(ai_msg)
    await db.commit()

    return {"response": response_text, "review_id": data.review_id}


@chat_router.get("/history/{review_id}")
async def get_chat_history(
    review_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.review_id == review_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return [{"role": m.role, "content": m.content, "created_at": m.created_at.isoformat()} for m in messages]


# ─── Reports Router ───────────────────────────────────────────────
reports_router = APIRouter(prefix="/api/reports", tags=["Reports"])


@reports_router.get("/{review_id}/markdown")
async def get_markdown_report(
    review_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    from fastapi.responses import PlainTextResponse
    report = _generate_markdown_report(review)
    return PlainTextResponse(
        content=report,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="review_{review_id[:8]}.md"'},
    )


def _generate_markdown_report(review: Review) -> str:
    ca = json.loads(review.code_analysis_result or "{}")
    sa = json.loads(review.security_analysis_result or "{}")
    pr = json.loads(review.pr_summary_result or "{}")
    rem = json.loads(review.remediation_result or "{}")

    lines = [
        f"# AI Code Review Report",
        f"**Review ID:** {review.id}",
        f"**Generated:** {review.created_at.strftime('%Y-%m-%d %H:%M UTC')}",
        f"**Processing Time:** {review.processing_time_seconds:.1f}s",
        "",
        "---",
        "",
        "## Executive Summary",
        "",
        f"**Verdict:** {pr.get('verdict', 'N/A')}",
        f"**Risk Level:** {sa.get('risk_level', 'N/A')}",
        f"**Quality Score:** {review.overall_score:.0f}/100",
        f"**Total Findings:** {review.total_findings}",
        "",
        "### Severity Breakdown",
        f"| Severity | Count |",
        f"|----------|-------|",
        f"| 🔴 Critical | {review.critical_count} |",
        f"| 🟠 High | {review.high_count} |",
        f"| 🟡 Medium | {review.medium_count} |",
        f"| 🟢 Low | {review.low_count} |",
        f"| ℹ️ Info | {review.info_count} |",
        "",
        "---",
        "",
        "## Code Analysis",
        "",
        ca.get("summary", ""),
        "",
        f"**Maintainability:** {ca.get('maintainability_rating', 'N/A')}",
        "",
    ]

    for f in ca.get("findings", []):
        lines.append(f"### [{f.get('severity', '').upper()}] {f.get('title', '')}")
        lines.append(f.get("description", ""))
        lines.append(f"**Recommendation:** {f.get('recommendation', '')}")
        lines.append("")

    lines += [
        "---",
        "",
        "## Security Analysis",
        "",
        sa.get("security_summary", ""),
        "",
    ]

    for v in sa.get("vulnerabilities", []):
        lines.append(f"### [{v.get('severity', '').upper()}] {v.get('title', '')}")
        lines.append(f"**OWASP:** {v.get('owasp_category', 'N/A')} | **CWE:** {v.get('cwe_id', 'N/A')}")
        lines.append(v.get("description", ""))
        lines.append(f"**Impact:** {v.get('impact', '')}")
        lines.append(f"**Fix:** {v.get('recommendation', '')}")
        lines.append("")

    lines += [
        "---",
        "",
        "## Remediation Roadmap",
        "",
        rem.get("remediation_summary", ""),
        "",
        f"**Estimated Effort:** {rem.get('effort_estimate', 'N/A')}",
        "",
    ]

    for i, r in enumerate(rem.get("refactoring_roadmap", []), 1):
        lines.append(f"{i}. **{r.get('action', '')}** — _{r.get('estimated_effort', '')}_")

    lines += [
        "",
        "---",
        "",
        "## PR Summary",
        "",
        pr.get("executive_summary", ""),
        "",
        f"*Generated by AI Code Review & Security Analysis Agent*",
    ]

    return "\n".join(lines)


# ─── Admin Router ─────────────────────────────────────────────────
admin_router = APIRouter(prefix="/api/admin", tags=["Administration"])


@admin_router.get("/stats")
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    total_users = await db.scalar(select(func.count(User.id)))
    total_reviews = await db.scalar(select(func.count(Review.id)))
    total_submissions = await db.scalar(select(func.count(CodeSubmission.id)))
    total_findings = await db.scalar(select(func.count(Finding.id)))

    return {
        "total_users": total_users,
        "total_reviews": total_reviews,
        "total_submissions": total_submissions,
        "total_findings": total_findings,
    }


@admin_router.get("/users")
async def list_all_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]


class UpdateUserRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    full_name: Optional[str] = None


@admin_router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    data: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin()),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if data.role:
        allowed_roles = {"admin", "developer", "reviewer"}
        if data.role not in allowed_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
        user.role = data.role

    if data.is_active is not None:
        user.is_active = data.is_active

    if data.full_name:
        user.full_name = data.full_name

    await db.commit()
    await db.refresh(user)
    return {"id": user.id, "email": user.email, "role": user.role, "is_active": user.is_active}
