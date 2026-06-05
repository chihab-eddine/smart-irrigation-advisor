from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.models.schemas import NewsletterSubscribeRequest, NewsletterUnsubscribeRequest, MessageResponse
from app.models.database import get_supabase

router = APIRouter()


@router.post("/subscribe", response_model=MessageResponse)
async def subscribe(request: NewsletterSubscribeRequest):
    """Subscribe to the newsletter (no auth required)."""
    db = get_supabase()

    # Check if already subscribed
    existing = (
        db.table("newsletter_subscribers")
        .select("id, is_active")
        .eq("email", request.email)
        .execute()
    )

    if existing.data:
        if existing.data[0]["is_active"]:
            return MessageResponse(
                message="Déjà abonné / مشترك بالفعل",
                success=True,
            )
        else:
            # Reactivate subscription
            db.table("newsletter_subscribers").update({
                "is_active": True,
                "locale": request.locale,
                "unsubscribed_at": None,
            }).eq("email", request.email).execute()
            return MessageResponse(
                message="Réabonnement réussi / تمت إعادة الاشتراك بنجاح",
                success=True,
            )

    # New subscription
    try:
        db.table("newsletter_subscribers").insert({
            "email": request.email,
            "locale": request.locale,
            "is_active": True,
        }).execute()
        return MessageResponse(
            message="Abonnement réussi / تم الاشتراك بنجاح",
            success=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to subscribe: {str(e)}")


@router.post("/unsubscribe", response_model=MessageResponse)
async def unsubscribe(request: NewsletterUnsubscribeRequest):
    """Unsubscribe from the newsletter."""
    db = get_supabase()

    result = (
        db.table("newsletter_subscribers")
        .update({
            "is_active": False,
            "unsubscribed_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("email", request.email)
        .execute()
    )

    return MessageResponse(
        message="Désabonnement réussi / تم إلغاء الاشتراك بنجاح",
        success=True,
    )
