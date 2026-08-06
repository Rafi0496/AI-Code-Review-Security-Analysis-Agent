"""Code submission API routes."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
from core.database import get_db
from core.security import get_current_active_user
from core.config import settings
from models.submission import CodeSubmission
from models.project import Project
from models.user import User

router = APIRouter(prefix="/api/submissions", tags=["Code Submissions"])

SUPPORTED_EXTENSIONS = {
    ".py": "python",
    ".java": "java",
    ".js": "javascript",
    ".ts": "typescript",
}


class SubmitCodeRequest(BaseModel):
    project_id: str
    source_code: str
    language: str = "python"
    filename: Optional[str] = None


@router.post("/", status_code=201)
async def submit_code(
    data: SubmitCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Submit code via paste/text input."""
    # Validate project exists
    result = await db.execute(select(Project).where(Project.id == data.project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate language
    if data.language not in settings.supported_languages:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language. Supported: {settings.supported_languages}",
        )

    # Validate code length
    max_chars = settings.max_file_size_mb * 1024 * 1024
    if len(data.source_code.encode()) > max_chars:
        raise HTTPException(status_code=400, detail="Code exceeds maximum size limit")

    submission = CodeSubmission(
        project_id=data.project_id,
        submitter_id=current_user.id,
        filename=data.filename or f"submitted.{data.language[:2]}",
        language=data.language,
        source_code=data.source_code,
        line_count=len(data.source_code.splitlines()),
        status="pending",
    )
    db.add(submission)
    await db.flush()
    await db.refresh(submission)

    return {
        "id": submission.id,
        "project_id": submission.project_id,
        "language": submission.language,
        "filename": submission.filename,
        "line_count": submission.line_count,
        "status": submission.status,
        "created_at": submission.created_at.isoformat(),
    }


@router.post("/upload", status_code=201)
async def upload_file(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Submit code via file upload."""
    # Validate project
    result = await db.execute(select(Project).where(Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate file extension
    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Supported: {list(SUPPORTED_EXTENSIONS.keys())}",
        )

    language = SUPPORTED_EXTENSIONS[ext]

    # Read file content
    content = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.max_file_size_mb}MB limit")

    source_code = content.decode("utf-8", errors="replace")

    submission = CodeSubmission(
        project_id=project_id,
        submitter_id=current_user.id,
        filename=filename,
        language=language,
        source_code=source_code,
        line_count=len(source_code.splitlines()),
        status="pending",
    )
    db.add(submission)
    await db.flush()
    await db.refresh(submission)

    return {
        "id": submission.id,
        "project_id": submission.project_id,
        "language": submission.language,
        "filename": submission.filename,
        "line_count": submission.line_count,
        "status": submission.status,
        "created_at": submission.created_at.isoformat(),
    }


@router.get("/")
async def list_submissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(CodeSubmission)
        .where(CodeSubmission.submitter_id == current_user.id)
        .order_by(CodeSubmission.created_at.desc())
        .limit(50)
    )
    submissions = result.scalars().all()
    return [
        {
            "id": s.id,
            "project_id": s.project_id,
            "filename": s.filename,
            "language": s.language,
            "line_count": s.line_count,
            "status": s.status,
            "created_at": s.created_at.isoformat(),
        }
        for s in submissions
    ]


@router.get("/{submission_id}")
async def get_submission(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(CodeSubmission).where(CodeSubmission.id == submission_id))
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {
        "id": s.id,
        "project_id": s.project_id,
        "submitter_id": s.submitter_id,
        "filename": s.filename,
        "language": s.language,
        "source_code": s.source_code,
        "line_count": s.line_count,
        "status": s.status,
        "created_at": s.created_at.isoformat(),
    }
