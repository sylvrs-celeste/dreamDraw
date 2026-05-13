"""Password checking and session tokens.

There is one account, so there is no user table and nothing to look up. A
correct password just means "this is the owner", and the token that follows
carries no identity beyond that.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# The token's only claim about who you are. Kept as a constant so it can't
# drift between the issuing and verifying sides.
SUBJECT = "owner"


def verify_password(candidate: str) -> bool:
    """Check a submitted password against the configured bcrypt hash."""
    if not settings.admin_password_hash:
        # Refuse rather than fall back to some default. An unconfigured
        # deployment should be impossible to log into, not trivially easy.
        return False
    try:
        return pwd_context.verify(candidate, settings.admin_password_hash)
    except ValueError:
        # Malformed hash in the environment. Same answer as a wrong password,
        # but worth distinguishing here so it isn't mistaken for a bcrypt bug.
        return False


def hash_password(plain: str) -> str:
    """Only used to generate a value for ADMIN_PASSWORD_HASH."""
    return pwd_context.hash(plain)


def create_session_token() -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": SUBJECT,
        "iat": now,
        "exp": now + timedelta(hours=settings.jwt_ttl_hours),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_session_token(token: str) -> dict[str, Any] | None:
    """Return the payload, or None if the token is expired, forged or junk."""
    if not settings.jwt_secret:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            # Pass the algorithm explicitly. Letting the token name its own
            # algorithm is how you end up accepting alg=none.
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError:
        return None

    if payload.get("sub") != SUBJECT:
        return None
    return payload
