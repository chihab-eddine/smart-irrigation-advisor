"""
Gemini-powered advisory endpoints.

All endpoints require authentication so an unauthenticated visitor can't burn
your Gemini quota.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_current_user
from app.models.schemas import (
    AITextResponse,
    ChatRequest,
    DiseaseTipsRequest,
    IrrigationTipsRequest,
    TokenPayload,
)
from app.models.database import get_supabase
from app.config import get_settings
from app.services import ai_service
from app.services.ai_service import AIUnavailableError
from app.services.weather_service import get_weather_data

router = APIRouter()
settings = get_settings()


def _ensure_available():
    if not ai_service.is_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI advisor is not configured on this server",
        )


@router.get("/status")
async def ai_status():
    """Public probe — does the backend have a working Gemini key?"""
    return {"available": ai_service.is_available(), "model": settings.gemini_model}


@router.post("/irrigation-tips", response_model=AITextResponse)
async def irrigation_tips(
    request: IrrigationTipsRequest,
    user: TokenPayload = Depends(get_current_user),
):
    _ensure_available()
    try:
        text = ai_service.irrigation_tips(request.model_dump(), locale=request.locale)
    except AIUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return AITextResponse(text=text, model=settings.gemini_model)


@router.post("/disease-tips", response_model=AITextResponse)
async def disease_tips(
    request: DiseaseTipsRequest,
    user: TokenPayload = Depends(get_current_user),
):
    _ensure_available()
    try:
        text = ai_service.disease_tips(request.model_dump(), locale=request.locale)
    except AIUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return AITextResponse(text=text, model=settings.gemini_model)


@router.get("/daily-insight", response_model=AITextResponse)
async def daily_insight(
    locale: str = "fr",
    user: TokenPayload = Depends(get_current_user),
):
    _ensure_available()

    db = get_supabase()
    name_key = "name_ar" if locale == "ar" else "name_fr"

    # Pull profile + last irrigations. Try the new preference column first; if it
    # doesn't exist yet (pre-migration DB), fall back to a minimal select so the
    # endpoint still works.
    profile_data: dict = {}
    try:
        profile = (
            db.table("users")
            .select("full_name, notification_region_id")
            .eq("id", user.sub)
            .maybe_single()
            .execute()
        )
        profile_data = (profile.data if profile else {}) or {}
    except Exception:
        try:
            profile = (
                db.table("users")
                .select("full_name")
                .eq("id", user.sub)
                .maybe_single()
                .execute()
            )
            profile_data = (profile.data if profile else {}) or {}
        except Exception:
            profile_data = {}

    recent = (
        db.table("irrigation_predictions")
        .select(
            "recommended_water_mm, alert_level, crops(name_fr,name_ar), moroccan_regions(id,name_fr,name_ar,latitude,longitude)"
        )
        .eq("user_id", user.sub)
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )
    recent_rows = recent.data or []

    # Pick a region to fetch weather for — preference > most recent > none
    region_row = None
    if profile_data.get("notification_region_id"):
        r = (
            db.table("moroccan_regions")
            .select("id,name_fr,name_ar,latitude,longitude")
            .eq("id", profile_data["notification_region_id"])
            .maybe_single()
            .execute()
        )
        region_row = r.data if r else None
    if not region_row and recent_rows:
        region_row = recent_rows[0].get("moroccan_regions")

    weather_summary = "—"
    if region_row and region_row.get("latitude") and region_row.get("longitude"):
        try:
            w = await get_weather_data(
                region_id=region_row["id"],
                latitude=region_row["latitude"],
                longitude=region_row["longitude"],
            )
            cur = (w or {}).get("current") or {}
            region_label = region_row.get(name_key) or region_row.get("name_fr") or ""
            weather_summary = (
                f"{region_label} — {cur.get('temperature', '?')}°C, "
                f"humidity {cur.get('humidity', '?')}%, rain {cur.get('precipitation', '?')} mm"
            )
        except Exception:
            pass

    ctx = {
        "user_name": profile_data.get("full_name") or "",
        "today": date.today().isoformat(),
        "weather": {"summary": weather_summary},
        "recent_irrigations": [
            {
                "crop": (r.get("crops") or {}).get(name_key) or "—",
                "region": (r.get("moroccan_regions") or {}).get(name_key) or "—",
                "water_mm": r.get("recommended_water_mm"),
                "alert": r.get("alert_level"),
            }
            for r in recent_rows
        ],
        "active_alerts": [
            {
                "crop": (r.get("crops") or {}).get(name_key) or "—",
                "region": (r.get("moroccan_regions") or {}).get(name_key) or "—",
                "water_mm": r.get("recommended_water_mm"),
                "alert": r.get("alert_level"),
            }
            for r in recent_rows
            if r.get("alert_level") in ("warning", "critical")
        ],
    }

    try:
        text = ai_service.daily_insight(ctx, locale=locale)
    except AIUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return AITextResponse(text=text, model=settings.gemini_model)


@router.post("/chat", response_model=AITextResponse)
async def chat(
    request: ChatRequest,
    user: TokenPayload = Depends(get_current_user),
):
    _ensure_available()
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages cannot be empty")
    if len(request.messages) > 30:
        raise HTTPException(status_code=400, detail="conversation too long")

    try:
        reply = ai_service.chat_reply(
            [m.model_dump() for m in request.messages],
            locale=request.locale,
        )
    except AIUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    return AITextResponse(text=reply, model=settings.gemini_model)
