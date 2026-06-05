"""
Daily reminder sender.

POST /api/reminders/send-daily
    Authorization: Bearer <REMINDERS_SECRET>
    body: {hour: int (0-23, UTC), dry_run: bool = false}

Designed to be invoked by a scheduler (GitHub Actions cron, etc.) every hour.
For each user whose `notification_enabled = true` AND `notification_hour = hour`,
the endpoint:
    1. Re-runs the irrigation prediction for their saved crop/region/soil/planting
       using current Open-Meteo weather (so the email reflects today, not yesterday).
    2. Asks Gemini for a personal one-paragraph insight.
    3. Sends an email via Resend.

The endpoint is idempotent — calling it twice in the same hour just re-sends.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.config import get_settings
from app.dependencies import get_current_user
from app.models.database import get_supabase
from app.models.schemas import TokenPayload
from app.services import ai_service, email_service
from app.services.email_service import render_daily_reminder
from app.services.irrigation_service import calculate_irrigation
from app.services.weather_service import get_weather_data

logger = logging.getLogger(__name__)
router = APIRouter()
settings = get_settings()


class SendDailyRequest(BaseModel):
    hour: int                   # 0-23, matches users.notification_hour
    minute: Optional[int] = None  # 0-59. None = "match any minute" (legacy hourly cron)
    dry_run: bool = False
    locale_override: Optional[str] = None   # force a locale; otherwise use user's preference / FR fallback


class SendDailyResult(BaseModel):
    matched: int
    sent: int
    failed: int
    skipped: int
    details: list[dict]


def _check_secret(authorization: str) -> None:
    if not settings.reminders_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="REMINDERS_SECRET not set on server",
        )
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.split("Bearer ", 1)[1].strip()
    if token != settings.reminders_secret:
        raise HTTPException(status_code=403, detail="Invalid reminders token")


async def _build_summary_for_user(user_row: dict, locale: str) -> str:
    """
    Generate the personalized email body for one user.

    If they have crop+region+soil preferences set, run a fresh prediction.
    Otherwise return a generic 'check the app' message.
    """
    db = get_supabase()
    name_key = "name_ar" if locale == "ar" else "name_fr"

    crop_id = user_row.get("notification_crop_id")
    region_id = user_row.get("notification_region_id")
    planting_date = user_row.get("notification_planting_date")

    # Fall back to the most recent prediction if no full preference is set
    if not (crop_id and region_id):
        last = (
            db.table("irrigation_predictions")
            .select("crop_id, region_id, soil_type_id, planting_date")
            .eq("user_id", user_row["id"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if last.data:
            crop_id = crop_id or last.data[0].get("crop_id")
            region_id = region_id or last.data[0].get("region_id")
            soil_type_id = last.data[0].get("soil_type_id")
            planting_date = planting_date or last.data[0].get("planting_date")
        else:
            soil_type_id = None
    else:
        soil_type_id = None

    # We need at minimum a region for the weather lookup
    if not region_id:
        return _generic_message(locale)

    region = (
        db.table("moroccan_regions").select("*").eq("id", region_id).maybe_single().execute()
    )
    if not region or not region.data:
        return _generic_message(locale)

    weather = await get_weather_data(
        region_id=region_id,
        latitude=region.data["latitude"],
        longitude=region.data["longitude"],
    )

    # Without a crop we can still summarize the weather
    if not crop_id:
        cur = (weather or {}).get("current") or {}
        return (
            f"Météo aujourd'hui à {region.data.get(name_key, '')} : "
            f"{cur.get('temperature', '?')}°C, humidité {cur.get('humidity', '?')}%, "
            f"pluie {cur.get('precipitation', '?')} mm."
            if locale != "ar"
            else f"الطقس اليوم في {region.data.get('name_ar', '')}: "
                 f"{cur.get('temperature', '?')}° مئوية، رطوبة {cur.get('humidity', '?')}%، "
                 f"أمطار {cur.get('precipitation', '?')} مم."
        )

    # Full prediction
    crop = db.table("crops").select("*").eq("id", crop_id).maybe_single().execute()
    soil = (
        db.table("soil_types").select("*").eq("id", soil_type_id).maybe_single().execute()
        if soil_type_id
        else None
    )
    if not crop or not crop.data:
        return _generic_message(locale)

    pdate = None
    if planting_date:
        try:
            pdate = (
                planting_date
                if isinstance(planting_date, date)
                else date.fromisoformat(planting_date)
            )
        except Exception:
            pdate = None

    result = calculate_irrigation(
        crop_data=crop.data,
        soil_data=(soil.data if soil and soil.data else {}),
        region_data=region.data,
        weather_data=weather,
        planting_date=pdate,
        locale=locale,
    )

    base = result["recommendation_ar"] if locale == "ar" else result["recommendation_fr"]

    # Layer Gemini on top if available
    if ai_service.is_available():
        try:
            ai_text = ai_service.irrigation_tips(
                {
                    "crop_name": crop.data.get(name_key, ""),
                    "region_name": region.data.get(name_key, ""),
                    "soil_type_name": (soil.data.get(name_key, "") if soil and soil.data else ""),
                    "growth_stage": result["growth_stage"],
                    "recommended_water_mm": result["recommended_water_mm"],
                    "eto_value": result["eto_value"],
                    "etc_value": result["etc_value"],
                    "alert_level": result["alert_level"],
                    "weather_summary": (weather or {}).get("current") or {},
                },
                locale=locale,
            )
            return f"{base}\n\n{ai_text}"
        except Exception as exc:
            logger.warning("AI tips failed for daily reminder: %s", exc)

    return base


def _generic_message(locale: str) -> str:
    if locale == "ar":
        return "افتح التطبيق لعرض توقعات الطقس وتوصيات الري لمنطقتك."
    return "Ouvrez l'application pour voir les prévisions et recommandations d'irrigation pour votre parcelle."


@router.post("/send-daily", response_model=SendDailyResult)
async def send_daily(
    body: SendDailyRequest,
    authorization: str = Header(default=""),
):
    _check_secret(authorization)

    if not email_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Email provider not configured (RESEND_API_KEY missing)",
        )

    db = get_supabase()
    query = (
        db.table("users")
        .select(
            "id, email, full_name, notification_hour, notification_minute, "
            "notification_region_id, notification_crop_id, notification_planting_date, "
            "is_active"
        )
        .eq("notification_enabled", True)
        .eq("notification_hour", body.hour)
    )
    if body.minute is not None:
        query = query.eq("notification_minute", body.minute)
    res = query.execute()
    users = [u for u in (res.data or []) if u.get("is_active", True)]

    sent = failed = skipped = 0
    details = []

    for u in users:
        try:
            email = u.get("email")
            if not email:
                skipped += 1
                details.append({"user_id": u["id"], "status": "skipped", "reason": "no email"})
                continue

            locale = body.locale_override or "fr"
            summary = await _build_summary_for_user(u, locale)
            subject, html, text = render_daily_reminder(
                name=u.get("full_name") or email.split("@")[0],
                locale=locale,
                summary_text=summary,
                app_url=settings.public_app_url,
            )

            if body.dry_run:
                details.append({"user_id": u["id"], "status": "dry_run", "preview": summary[:200]})
                sent += 1
                continue

            msg_id = email_service.send_email(to=email, subject=subject, html=html, text=text)
            details.append({"user_id": u["id"], "status": "sent", "message_id": msg_id})
            sent += 1

        except Exception as exc:
            logger.exception("Failed to send reminder for user %s", u.get("id"))
            failed += 1
            details.append({"user_id": u.get("id"), "status": "failed", "error": str(exc)})

    return SendDailyResult(
        matched=len(users),
        sent=sent,
        failed=failed,
        skipped=skipped,
        details=details,
    )


class SendTestRequest(BaseModel):
    locale: str = "fr"


@router.post("/send-test")
async def send_test(
    body: SendTestRequest,
    user: TokenPayload = Depends(get_current_user),
):
    """
    Send the daily-reminder email to the currently-authenticated user immediately,
    bypassing the hour/minute schedule. Useful for testing the template + Brevo
    delivery without waiting for a cron tick.
    """
    if not email_service.is_available():
        raise HTTPException(
            status_code=503,
            detail="Email provider not configured (RESEND_API_KEY missing)",
        )

    db = get_supabase()
    res = (
        db.table("users")
        .select(
            "id, email, full_name, notification_region_id, notification_crop_id, "
            "notification_planting_date"
        )
        .eq("id", user.sub)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="User profile not found")
    u = res.data
    if not u.get("email"):
        raise HTTPException(status_code=400, detail="No email on file for this user")

    locale = body.locale if body.locale in ("fr", "ar") else "fr"
    summary = await _build_summary_for_user(u, locale)
    subject, html, text = render_daily_reminder(
        name=u.get("full_name") or u["email"].split("@")[0],
        locale=locale,
        summary_text=summary,
        app_url=settings.public_app_url,
    )
    msg_id = email_service.send_email(to=u["email"], subject=subject, html=html, text=text)
    return {"status": "sent", "message_id": msg_id, "to": u["email"]}
