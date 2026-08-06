"""Finding ORM model — individual issues detected by agents."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    review_id: Mapped[str] = mapped_column(String(36), ForeignKey("reviews.id"), nullable=False)

    # Finding classification
    agent_type: Mapped[str] = mapped_column(
        Enum("code_analysis", "security", "remediation", name="agent_type"),
        nullable=False,
    )
    severity: Mapped[str] = mapped_column(
        Enum("critical", "high", "medium", "low", "info", name="severity_level"),
        nullable=False,
        default="info",
    )
    category: Mapped[str] = mapped_column(String(100), nullable=True)  # e.g. "SQL Injection", "Code Smell"
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=True)
    code_example: Mapped[str] = mapped_column(Text, nullable=True)
    line_number: Mapped[int] = mapped_column(Integer, nullable=True)
    owasp_category: Mapped[str] = mapped_column(String(100), nullable=True)  # e.g. "A03:2021"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    review: Mapped["Review"] = relationship("Review", back_populates="findings")

    def __repr__(self):
        return f"<Finding {self.severity}: {self.title[:50]}>"
