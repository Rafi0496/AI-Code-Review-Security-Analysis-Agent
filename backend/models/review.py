"""Review ORM model."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("code_submissions.id"), nullable=False
    )
    # Agent outputs stored as text/JSON
    code_analysis_result: Mapped[str] = mapped_column(Text, nullable=True)
    security_analysis_result: Mapped[str] = mapped_column(Text, nullable=True)
    remediation_result: Mapped[str] = mapped_column(Text, nullable=True)
    pr_summary_result: Mapped[str] = mapped_column(Text, nullable=True)

    # Aggregated stats
    total_findings: Mapped[int] = mapped_column(Integer, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, default=0)
    high_count: Mapped[int] = mapped_column(Integer, default=0)
    medium_count: Mapped[int] = mapped_column(Integer, default=0)
    low_count: Mapped[int] = mapped_column(Integer, default=0)
    info_count: Mapped[int] = mapped_column(Integer, default=0)
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)

    processing_time_seconds: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    submission: Mapped["CodeSubmission"] = relationship("CodeSubmission", back_populates="reviews")
    findings: Mapped[list["Finding"]] = relationship("Finding", back_populates="review", lazy="selectin")
    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage", back_populates="review", lazy="selectin"
    )

    def __repr__(self):
        return f"<Review {self.id} findings={self.total_findings}>"


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    review_id: Mapped[str] = mapped_column(String(36), ForeignKey("reviews.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    review: Mapped["Review"] = relationship("Review", back_populates="chat_messages")
