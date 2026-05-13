"""Shared route dependencies: client IP resolution and the auth guard."""

from fastapi import Depends, HTTPException, Request, status

from app.config import settings
from app.services.security import decode_session_token


def client_ip(request: Request) -> str:
    """Best available identity for rate limiting.

    In production the chain is browser -> CloudFront -> ALB -> here, so the
    socket address is always the ALB and useless on its own.

    CloudFront-Viewer-Address is set by CloudFront itself and overwrites
    anything the client sent, so it is the one header worth trusting. It needs
    the AllViewerExceptHostHeader origin request policy to arrive at all.

    X-Forwarded-For is the fallback and is only as honest as whatever is in
    front of us. Good enough to slow down a login form, not something to make
    a security decision on.
    """
    viewer = request.headers.get("cloudfront-viewer-address")
    if viewer:
        # Arrives as "ip:port" for both IPv4 and IPv6, so split off the last
        # colon rather than the first.
        return viewer.rsplit(":", 1)[0]

    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()

    return request.client.host if request.client else "unknown"


def current_session(request: Request) -> dict | None:
    """Decode the session cookie if there is a valid one. Never raises."""
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    return decode_session_token(token)


def require_session(session: dict | None = Depends(current_session)) -> dict:
    """Guard for every mutating route. 401 when the session is missing or bad."""
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return session
