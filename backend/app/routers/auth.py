"""Login, logout, and session status."""

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.config import settings
from app.deps import client_ip, current_session, require_session
from app.schemas.auth import LoginRequest, MessageResponse, SessionStatus
from app.services.rate_limit import SlidingWindowLimiter
from app.services.security import create_session_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

login_limiter = SlidingWindowLimiter(
    max_attempts=settings.login_rate_limit_attempts,
    window_seconds=settings.login_rate_limit_window_minutes * 60,
)


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.jwt_ttl_seconds,
        httponly=True,
        # Off locally because there's no TLS on the dev server; the ALB is
        # locked to CloudFront in production, so this is never sent in clear.
        secure=settings.session_cookie_secure,
        # Lax keeps the cookie on normal navigation but drops it on
        # cross-site POSTs, which is the CSRF case worth caring about here.
        samesite="lax",
        path="/",
    )


@router.post("/login", response_model=SessionStatus)
async def login(
    payload: LoginRequest,
    response: Response,
    ip: str = Depends(client_ip),
) -> SessionStatus:
    allowed, retry_after = login_limiter.check(ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    if not verify_password(payload.password):
        login_limiter.record_failure(ip)
        # Deliberately vague. There is only one account, so naming the reason
        # would only tell an attacker whether they had found the password.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )

    login_limiter.reset(ip)
    _set_session_cookie(response, create_session_token())
    return SessionStatus(authenticated=True)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    _session: dict = Depends(require_session),
) -> MessageResponse:
    # delete_cookie has to match the path the cookie was set with, or the
    # browser keeps the original and the user stays logged in.
    response.delete_cookie(key=settings.session_cookie_name, path="/")
    return MessageResponse(message="Signed out")


@router.get("/me", response_model=SessionStatus)
async def me(session: dict | None = Depends(current_session)) -> SessionStatus:
    """Public on purpose. The frontend calls this on load to decide whether to
    show the admin chrome, and an anonymous visitor should get a plain false
    rather than a 401 to handle.
    """
    return SessionStatus(authenticated=session is not None)
