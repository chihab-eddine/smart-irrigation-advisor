from fastapi import APIRouter, HTTPException
from app.models.schemas import ContactRequest, MessageResponse
from app.models.database import get_supabase

router = APIRouter()


@router.post("/contact", response_model=MessageResponse)
async def submit_contact(request: ContactRequest):
    """Submit a contact message (no auth required)."""
    db = get_supabase()

    contact_data = {
        "full_name": request.full_name,
        "email": request.email,
        "subject": request.subject,
        "message": request.message,
        "status": "new",
    }

    try:
        db.table("contact_messages").insert(contact_data).execute()
        return MessageResponse(
            message="Message envoyé avec succès / تم إرسال الرسالة بنجاح",
            success=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save message: {str(e)}")
