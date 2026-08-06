"""Application configuration using Pydantic Settings."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Google AI
    google_api_key: str = ""

    # Database
    database_url: str = "postgresql+asyncpg://codereviewer:codereviewer123@localhost:5432/codereview_db"

    # JWT
    jwt_secret_key: str = "super-secret-jwt-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440

    # ChromaDB
    chromadb_host: str = "localhost"
    chromadb_port: int = 8001
    chromadb_collection: str = "secure_coding_kb"

    # App
    app_name: str = "AI Code Review & Security Analysis Agent"
    debug: bool = True
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    # Gemini model
    gemini_model: str = "gemini-2.0-flash"
    embedding_model: str = "models/text-embedding-004"

    # File upload limits
    max_file_size_mb: int = 5
    supported_languages: list = ["python", "java", "javascript", "typescript"]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
