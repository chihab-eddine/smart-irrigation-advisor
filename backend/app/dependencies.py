"""
JWT verification & auth dependencies for Supabase tokens.

Supports both signing strategies that Supabase issues in the wild:
- HS256 with a project-wide shared secret (legacy / GoTrue)
- RS256 via JWKS published at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`

Set `SUPABASE_JWT_SECRET` for HS256. If it's empty, we fall back to JWKS.
"""
import logging
from functools import lru_cache
from typing import Any, Optional

import httpx
from fastapi import Depends, HTTPException, Request, status
from jose import jwt, JWTError

from app.config import get_settings
from app.models.database import get_supabase
from app.models.schemas import TokenPayload

logger = logging.getLogger(__name__)
settings = get_settings()

EXPECTED_AUD = "authenticated"


@lru_cache(maxsize=1)
def _jwks() -> dict[str, Any] | None:
    """Fetch and cache the Supabase JWKS document."""
    if not settings.supabase_url:
        return None
    url = settings.supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
    try:
        with httpx.Client(timeout=5.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return resp.json()
    except Exception as exc:
        logger.warning("JWKS fetch failed (%s): %s", url, exc)
        return None


def _verify_token(token: str) -> dict:
    """Verify the JWT signature and return the decoded payload."""
    # Prefer HS256 with shared secret when one is configured.
    if settings.supabase_jwt_secret:
        try:
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=EXPECTED_AUD,
                options={"verify_aud": True},
            )
        except JWTError as exc:
            # Fall through to JWKS only if no JWKS was reachable — otherwise re-raise.
            jwks = _jwks()
            if not jwks:
                raise exc

    jwks = _jwks()
    if not jwks:
        raise JWTError("No JWT verification key available (set SUPABASE_JWT_SECRET or expose JWKS)")

    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise JWTError(f"Malformed JWT header: {exc}")

    kid = unverified_header.get("kid")
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
    if not key:
        # Cache miss could mean keys rotated — refresh once.
        _jwks.cache_clear()
        jwks = _jwks() or {}
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)
        if not key:
            raise JWTError("Signing key not found in JWKS")

    return jwt.decode(
        token,
        key,
        algorithms=[key.get("alg", "RS256")],
        audience=EXPECTED_AUD,
        options={"verify_aud": True},
    )


async def get_current_user(request: Request) -> TokenPayload:
    """Extract and verify the Supabase JWT from the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    token = auth_header.split("Bearer ", 1)[1].strip()

    try:
        payload = _verify_token(token)
    except JWTError as exc:
        logger.info("JWT verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    email = payload.get("email")

    db = get_supabase()
    profile = (
        db.table("users")
        .select("role, is_active")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )

    if not profile or not profile.data:
        # Token is valid but the profile row hasn't been provisioned yet.
        # The schema's `handle_new_user` trigger should prevent this — return 401
        # so the frontend prompts re-login, which retriggers the signup flow.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User profile missing",
        )

    if not profile.data.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return TokenPayload(
        sub=user_id,
        email=email,
        role=profile.data.get("role", "user"),
    )


async def require_admin(user: TokenPayload = Depends(get_current_user)) -> TokenPayload:
    """Require the current user to have admin role."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


async def get_optional_user(request: Request) -> Optional[TokenPayload]:
    """Like get_current_user but returns None instead of 401 if no/bad token.

    Use for endpoints that work for anonymous visitors but enrich the response
    when the caller is signed in (e.g. blog reads showing "your rating").
    """
    try:
        return await get_current_user(request)
    except HTTPException:
        return None
