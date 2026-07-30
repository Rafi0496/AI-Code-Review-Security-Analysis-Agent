"""
Clean Python sample — used for testing agents.
Demonstrates secure coding practices. Should produce minimal/no findings.
"""

import os
import logging
import bcrypt
import sqlite3
from typing import Optional

logger = logging.getLogger(__name__)


class UserRepository:
    """
    Manages user data access with parameterized queries and proper error handling.
    """

    def __init__(self, db_path: str):
        """
        Initialize repository with the database path.

        Args:
            db_path: Path to the SQLite database file.
        """
        self.db_path = db_path

    def get_user_by_credentials(
        self, username: str, password: str
    ) -> Optional[dict]:
        """
        Authenticate a user by username and hashed password.

        Args:
            username: The user's username.
            password: The plaintext password to verify.

        Returns:
            User dict if authentication succeeds, None otherwise.
        """
        if not username or not password:
            logger.warning("Empty username or password provided")
            return None

        # Validate input length
        if len(username) > 100 or len(password) > 200:
            logger.warning("Input too long — possible attack attempt")
            return None

        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()

                # Parameterized query — safe from SQL injection
                cursor.execute(
                    "SELECT id, username, hashed_password FROM users WHERE username = ?",
                    (username,),
                )
                row = cursor.fetchone()

                if row is None:
                    return None

                # Verify password using bcrypt
                if not self._verify_password(password, row["hashed_password"]):
                    return None

                return {"id": row["id"], "username": row["username"]}

        except sqlite3.Error as e:
            logger.error("Database error during authentication: %s", e)
            return None

    def _verify_password(self, plaintext: str, hashed: str) -> bool:
        """
        Verify a bcrypt-hashed password.

        Args:
            plaintext: The user-supplied password.
            hashed: The stored bcrypt hash.

        Returns:
            True if password matches, False otherwise.
        """
        try:
            return bcrypt.checkpw(
                plaintext.encode("utf-8"), hashed.encode("utf-8")
            )
        except Exception as e:
            logger.error("Password verification failed: %s", e)
            return False


class PasswordHasher:
    """Provides secure password hashing utilities using bcrypt."""

    BCRYPT_ROUNDS = 12

    def hash_password(self, password: str) -> str:
        """
        Hash a plaintext password using bcrypt.

        Args:
            password: Plaintext password to hash.

        Returns:
            bcrypt hash string.

        Raises:
            ValueError: If password is empty or too short.
        """
        if not password or len(password) < 8:
            raise ValueError("Password must be at least 8 characters long")

        hashed = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt(rounds=self.BCRYPT_ROUNDS),
        )
        return hashed.decode("utf-8")


def load_config() -> dict:
    """
    Load application configuration from environment variables.

    Returns:
        Configuration dict with required settings.

    Raises:
        RuntimeError: If required environment variables are not set.
    """
    api_key = os.getenv("API_KEY")
    db_url = os.getenv("DATABASE_URL")
    secret_key = os.getenv("SECRET_KEY")

    missing = [k for k, v in {
        "API_KEY": api_key,
        "DATABASE_URL": db_url,
        "SECRET_KEY": secret_key,
    }.items() if not v]

    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}"
        )

    return {
        "api_key": api_key,
        "database_url": db_url,
        "secret_key": secret_key,
    }


def process_items(items: list, multiplier: float = 1.0) -> list:
    """
    Process a list of numeric items with an optional multiplier.

    Args:
        items: List of numbers to process.
        multiplier: Factor to scale each item.

    Returns:
        List of processed items.
    """
    if not isinstance(items, list):
        raise TypeError(f"Expected list, got {type(items).__name__}")
    if multiplier <= 0:
        raise ValueError("Multiplier must be positive")

    return [item * multiplier for item in items]
