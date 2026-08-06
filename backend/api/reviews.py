"""Reviews API — triggers multi-agent pipeline and retrieves results."""
import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from core.database import get_db
from core.security import get_current_active_user
from models.submission import CodeSubmission
from models.review import Review
from models.finding import Finding
from models.user import User
from agents.orchestrator import pipeline

router = APIRouter(prefix="/api/reviews", tags=["Reviews"])


async def _run_analysis(submission_id: str, db_url: str):
    """Background task to run the full agent pipeline."""
    from core.database import AsyncSessionLocal
    from sqlalchemy import update

    async with AsyncSessionLocal() as db:
        # Get submission
        result = await db.execute(select(CodeSubmission).where(CodeSubmission.id == submission_id))
        submission = result.scalar_one_or_none()
        if not submission:
            return

        # Update status to analyzing
        await db.execute(
            update(CodeSubmission).where(CodeSubmission.id == submission_id).values(status="analyzing")
        )
        await db.commit()

        try:
            # Run the pipeline
            results = await pipeline.run(
                code=submission.source_code,
                language=submission.language,
                filename=submission.filename,
            )

            stats = results["stats"]
            findings_flat = results["findings_flat"]

            # Create review record
            review = Review(
                submission_id=submission_id,
                code_analysis_result=json.dumps(results["code_analysis"]),
                security_analysis_result=json.dumps(results["security_analysis"]),
                remediation_result=json.dumps(results["remediation"]),
                pr_summary_result=json.dumps(results["pr_summary"]),
                total_findings=stats["total_findings"],
                critical_count=stats.get("critical_count", 0),
                high_count=stats.get("high_count", 0),
                medium_count=stats.get("medium_count", 0),
                low_count=stats.get("low_count", 0),
                info_count=stats.get("info_count", 0),
                overall_score=float(stats.get("quality_score", 0)),
                processing_time_seconds=stats.get("processing_time_seconds", 0),
            )
            db.add(review)
            await db.flush()

            # Save individual findings
            for f in findings_flat:
                finding = Finding(
                    review_id=review.id,
                    agent_type=f["agent_type"],
                    severity=f["severity"],
                    category=f.get("category", "General"),
                    title=f["title"],
                    description=f["description"],
                    recommendation=f.get("recommendation"),
                    code_example=f.get("code_example"),
                    line_number=f.get("line_number"),
                    owasp_category=f.get("owasp_category"),
                )
                db.add(finding)

            # Mark submission as completed
            await db.execute(
                update(CodeSubmission).where(CodeSubmission.id == submission_id).values(status="completed")
            )
            await db.commit()

        except Exception as e:
            print(f"[Reviews] Pipeline error: {e}")
            await db.execute(
                update(CodeSubmission).where(CodeSubmission.id == submission_id).values(status="failed")
            )
            await db.commit()


@router.post("/analyze/{submission_id}", status_code=202)
async def analyze_submission(
    submission_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Trigger the multi-agent analysis pipeline for a submission."""
    result = await db.execute(select(CodeSubmission).where(CodeSubmission.id == submission_id))
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    if submission.status == "analyzing":
        raise HTTPException(status_code=409, detail="Analysis already in progress")

    from core.config import settings
    background_tasks.add_task(_run_analysis, submission_id, settings.database_url)

    return {"message": "Analysis started", "submission_id": submission_id, "status": "analyzing"}


@router.post("/analyze-sync/{submission_id}")
async def analyze_submission_sync(
    submission_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Synchronous analysis — waits for pipeline to complete (for demos)."""
    result = await db.execute(select(CodeSubmission).where(CodeSubmission.id == submission_id))
    submission = result.scalar_one_or_none()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    from sqlalchemy import update
    await db.execute(
        update(CodeSubmission).where(CodeSubmission.id == submission_id).values(status="analyzing")
    )
    await db.commit()

    try:
        results = await pipeline.run(
            code=submission.source_code,
            language=submission.language,
            filename=submission.filename,
        )

        stats = results["stats"]
        findings_flat = results["findings_flat"]

        review = Review(
            submission_id=submission_id,
            code_analysis_result=json.dumps(results["code_analysis"]),
            security_analysis_result=json.dumps(results["security_analysis"]),
            remediation_result=json.dumps(results["remediation"]),
            pr_summary_result=json.dumps(results["pr_summary"]),
            total_findings=stats["total_findings"],
            critical_count=stats.get("critical_count", 0),
            high_count=stats.get("high_count", 0),
            medium_count=stats.get("medium_count", 0),
            low_count=stats.get("low_count", 0),
            info_count=stats.get("info_count", 0),
            overall_score=float(stats.get("quality_score", 0)),
            processing_time_seconds=stats.get("processing_time_seconds", 0),
        )
        db.add(review)
        await db.flush()

        for f in findings_flat:
            finding = Finding(
                review_id=review.id,
                agent_type=f["agent_type"],
                severity=f["severity"],
                category=f.get("category", "General"),
                title=f["title"],
                description=f["description"],
                recommendation=f.get("recommendation"),
                code_example=f.get("code_example"),
                line_number=f.get("line_number"),
                owasp_category=f.get("owasp_category"),
            )
            db.add(finding)

        await db.execute(
            update(CodeSubmission).where(CodeSubmission.id == submission_id).values(status="completed")
        )
        await db.commit()
        await db.refresh(review)

        return {
            "review_id": review.id,
            "submission_id": submission_id,
            "stats": stats,
            "code_analysis": results["code_analysis"],
            "security_analysis": results["security_analysis"],
            "remediation": results["remediation"],
            "pr_summary": results["pr_summary"],
        }

    except Exception as e:
        await db.execute(
            update(CodeSubmission).where(CodeSubmission.id == submission_id).values(status="failed")
        )
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/")
async def list_reviews(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Review).order_by(Review.created_at.desc()).limit(50))
    reviews = result.scalars().all()
    return [
        {
            "id": r.id,
            "submission_id": r.submission_id,
            "total_findings": r.total_findings,
            "critical_count": r.critical_count,
            "high_count": r.high_count,
            "medium_count": r.medium_count,
            "low_count": r.low_count,
            "info_count": r.info_count,
            "overall_score": r.overall_score,
            "processing_time_seconds": r.processing_time_seconds,
            "created_at": r.created_at.isoformat(),
        }
        for r in reviews
    ]


@router.get("/{review_id}")
async def get_review(
    review_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    return {
        "id": review.id,
        "submission_id": review.submission_id,
        "code_analysis": json.loads(review.code_analysis_result or "{}"),
        "security_analysis": json.loads(review.security_analysis_result or "{}"),
        "remediation": json.loads(review.remediation_result or "{}"),
        "pr_summary": json.loads(review.pr_summary_result or "{}"),
        "findings": [
            {
                "id": f.id,
                "agent_type": f.agent_type,
                "severity": f.severity,
                "category": f.category,
                "title": f.title,
                "description": f.description,
                "recommendation": f.recommendation,
                "code_example": f.code_example,
                "line_number": f.line_number,
                "owasp_category": f.owasp_category,
            }
            for f in review.findings
        ],
        "stats": {
            "total_findings": review.total_findings,
            "critical_count": review.critical_count,
            "high_count": review.high_count,
            "medium_count": review.medium_count,
            "low_count": review.low_count,
            "info_count": review.info_count,
            "overall_score": review.overall_score,
            "processing_time_seconds": review.processing_time_seconds,
        },
        "created_at": review.created_at.isoformat(),
    }
