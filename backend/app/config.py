"""Application settings.

Everything configurable lives here so nothing else has to touch os.environ.
The numeric defaults come straight from the spec; the frontend and the image
pipeline both assume them, so don't change one without checking the other.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # -- environment ----------------------------------------------------
    env: Literal["dev", "prod"] = "dev"
    frontend_origin: str = "http://localhost:5173"

    # -- database -------------------------------------------------------
    database_url: str = "postgresql+asyncpg://dreamdraw:dreamdraw@db:5432/dreamdraw"

    # -- auth -----------------------------------------------------------
    admin_password_hash: str = ""
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_ttl_hours: int = 24

    session_cookie_name: str = "dreamdraw_session"
    # False locally since there's no TLS in front of the dev server.
    session_cookie_secure: bool = False

    login_rate_limit_attempts: int = 5
    login_rate_limit_window_minutes: int = 15

    # -- aws ------------------------------------------------------------
    s3_bucket: str = ""
    aws_region: str = "us-east-1"
    # Point boto3 at an S3-compatible server (MinIO) for local work. Empty
    # means real S3. Only the endpoint changes; the presigning path is the same.
    s3_endpoint_url: str = ""
    # Keep the frontend's query stale time below this or a tab left open
    # overnight will try to render expired URLs.
    presign_ttl_seconds: int = 3600

    # -- uploads --------------------------------------------------------
    max_upload_bytes: int = 25 * 1024 * 1024
    max_files_per_entry: int = 20
    # HEIC is accepted because phones shoot it. It is decoded and converted
    # like anything else; derivatives are always WebP, so nothing downstream
    # has to know a browser cannot render HEIC.
    allowed_mime_types: tuple[str, ...] = (
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
    )

    # -- derivatives ----------------------------------------------------
    thumb_max_edge: int = 400
    medium_max_edge: int = 1400
    webp_quality: int = 82

    # -- pagination -----------------------------------------------------
    default_page_size: int = 24
    max_page_size: int = 100

    @model_validator(mode="after")
    def _check_password_hash(self) -> "Settings":
        """Fail at boot on a mangled hash rather than at every login.

        docker compose interpolates $ in env files, and a bcrypt hash is full
        of them: $2b$12$Tlk... becomes $2b$12. with the rest eaten as an unset
        variable. The app starts, health checks pass, and every sign-in is
        rejected for no visible reason. Escape them as $$ in .env.
        """
        h = self.admin_password_hash
        if not h:
            return self  # unconfigured is allowed; login simply refuses
        if len(h) != 60 or not h.startswith(("$2a$", "$2b$", "$2y$")):
            raise ValueError(
                f"ADMIN_PASSWORD_HASH does not look like bcrypt "
                f"(got {len(h)} chars, expected 60). If you are running under "
                f"docker compose, escape every $ in the hash as $$ in .env."
            )
        return self

    @property
    def is_dev(self) -> bool:
        return self.env == "dev"

    @property
    def jwt_ttl_seconds(self) -> int:
        return self.jwt_ttl_hours * 3600


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached so the .env file is parsed once per process."""
    return Settings()


settings = get_settings()
