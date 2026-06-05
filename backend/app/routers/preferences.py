"""
User-facing preferences (notifications, default crop/region/soil for reminders).
"""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.models.database import get_supabase
from app.models.schemas import NotificationPreferences, TokenPayload

router = APIRouter()

PREF_FIELDS = [
    "notification_enabled",
    "notification_hour",
    "notification_minute",
    "notification_region_id",
    "notification_crop_id",
    "notification_planting_date",
]


@router.get("/notifications", response_model=NotificationPreferences)
async def get_notification_prefs(user: TokenPayload = Depends(get_current_user)):
    db = get_supabase()
    row = (
        db.table("users")
        .select(", ".join(PREF_FIELDS))
        .eq("id", user.sub)
        .maybe_single()
        .execute()
    )
    if not row or not row.data:
        raise HTTPException(status_code=404, detail="User not found")
    return NotificationPreferences(**row.data)


@router.put("/notifications", response_model=NotificationPreferences)
async def update_notification_prefs(
    prefs: NotificationPreferences,
    user: TokenPayload = Depends(get_current_user),
):
    if not 0 <= prefs.notification_hour <= 23:
        raise HTTPException(status_code=400, detail="notification_hour must be 0..23")
    if not 0 <= prefs.notification_minute <= 59:
        raise HTTPException(status_code=400, detail="notification_minute must be 0..59")

    update = prefs.model_dump()
    if update.get("notification_planting_date") is not None:
        update["notification_planting_date"] = str(update["notification_planting_date"])

    db = get_supabase()
    res = db.table("users").update(update).eq("id", user.sub).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return NotificationPreferences(**res.data[0])
