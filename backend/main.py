"""
FastAPI Application Entry Point
AI Code Review & Security Analysis Agent — Backend
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from core.config import settings
from core.database import init_db
from api.auth import router as auth_router
from api.submissions import router as submissions_router
from api.reviews import router as reviews_router
from api.routes import (
    projects_router,
    chat_router,
    reports_router,
    admin_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    print(f"[App] Starting {settings.app_name}")

    # Initialize database tables
    print("[App] Initializing database...")
    await init_db()
    print("[App] Database ready")

    # Seed knowledge base
    print("[App] Seeding knowledge base...")
    try:
        from rag.seeder import seed_knowledge_base
        await seed_knowledge_base()
    except Exception as e:
        print(f"[App] Knowledge base seeding failed: {e} (non-fatal)")

    # Create default admin user if not exists
    await _create_default_admin()

    print(f"[App] Ready on http://{settings.backend_host}:{settings.backend_port}")
    yield
    print("[App] Shutting down...")


async def _create_default_admin():
    """Create a default admin account for demo purposes."""
    from core.database import AsyncSessionLocal
    from sqlalchemy import select
    from models.user import User
    from core.security import hash_password

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "admin@demo.com"))
        if not result.scalar_one_or_none():
            admin = User(
                email="admin@demo.com",
                username="admin",
                hashed_password=hash_password("admin123"),
                full_name="System Administrator",
                role="admin",
            )
            db.add(admin)
            # Also create a demo developer
            dev = User(
                email="dev@demo.com",
                username="developer",
                hashed_password=hash_password("dev123"),
                full_name="Demo Developer",
                role="developer",
            )
            db.add(dev)
            await db.commit()
            print("[App] Default accounts created: admin@demo.com / admin123 | dev@demo.com / dev123")


# ─── App Instance ─────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    description="Multi-agent AI platform for automated code review and security analysis",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(submissions_router)
app.include_router(reviews_router)
app.include_router(chat_router)
app.include_router(reports_router)
app.include_router(admin_router)


# ─── Health Check ─────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": "1.0.0",
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "AI Code Review & Security Analysis Agent API",
        "docs": "/docs",
        "version": "1.0.0",
    }
