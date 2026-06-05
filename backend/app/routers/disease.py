from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status

from app.dependencies import get_current_user
from app.models.schemas import TokenPayload, DiseaseResponse
from app.models.database import get_supabase
from app.services.disease_service import (
    predict_disease,
    get_disease_info,
    model_status,
    ModelUnavailableError,
)
from app.services.storage_service import upload_disease_image

router = APIRouter()


@router.post("/predict", response_model=DiseaseResponse)
async def detect_disease(
    image: UploadFile = File(...),
    locale: str = Form("fr"),
    crop_type: str = Form(""),
    user: TokenPayload = Depends(get_current_user),
):
    """Detect plant disease from an uploaded leaf image.

    Pass `crop_type` (e.g. "Tomato", "Apple") when you know which plant is in
    the photo — predictions are restricted to that crop's classes, which
    dramatically reduces cross-crop confusion on field photos.
    """
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await image.read()

    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be less than 5 MB")
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Image is empty")

    try:
        prediction = predict_disease(image_bytes, crop_type=crop_type or None)
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to process image: {exc}")

    image_url = upload_disease_image(
        user_id=user.sub,
        image_bytes=image_bytes,
        content_type=image.content_type,
        original_filename=image.filename,
    )

    db = get_supabase()
    prediction_data = {
        "user_id": user.sub,
        "image_url": image_url,
        "disease_key": prediction["disease_key"],
        "disease_name_fr": prediction["name_fr"],
        "disease_name_ar": prediction["name_ar"],
        "confidence_score": prediction["confidence"],
        "treatment_fr": prediction["treatment_fr"],
        "treatment_ar": prediction["treatment_ar"],
        "crop_type": prediction.get("crop_type", ""),
    }
    saved = db.table("disease_predictions").insert(prediction_data).execute()

    name_key = f"name_{locale}" if locale in ("fr", "ar") else "name_fr"
    treatment_key = f"treatment_{locale}" if locale in ("fr", "ar") else "treatment_fr"

    return DiseaseResponse(
        id=saved.data[0]["id"] if saved.data else None,
        disease_key=prediction["disease_key"],
        disease_name=prediction.get(name_key, prediction["name_fr"]),
        confidence_score=prediction["confidence"],
        treatment=prediction.get(treatment_key, prediction["treatment_fr"]),
        crop_type=prediction.get("crop_type", ""),
        image_url=image_url,
        top_predictions=[
            {
                "disease_key": item.get("disease_key", ""),
                "disease_name": item.get(name_key, item.get("name_fr", "")),
                "crop_type": item.get("crop_type", ""),
                "confidence": item.get("confidence", 0),
            }
            for item in prediction.get("top_predictions", [])
        ],
        uncertain=prediction.get("uncertain", False),
        entropy=prediction.get("entropy", 0),
        created_at=saved.data[0]["created_at"] if saved.data else None,
    )


@router.get("/history")
async def get_disease_history(
    user: TokenPayload = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
):
    """Get user's disease prediction history (paginated)."""
    db = get_supabase()
    result = (
        db.table("disease_predictions")
        .select("*", count="exact")
        .eq("user_id", user.sub)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"data": result.data, "total": result.count or 0}


@router.get("/classes")
async def get_disease_classes():
    """Get list of all detectable diseases."""
    return get_disease_info()


@router.get("/status")
async def get_model_status():
    """Report whether the disease detection model is loadable."""
    return model_status()


@router.get("/{prediction_id}")
async def get_disease_prediction(
    prediction_id: str,
    locale: str = "fr",
    user: TokenPayload = Depends(get_current_user),
):
    """Consult one saved disease diagnosis."""
    db = get_supabase()
    result = (
        db.table("disease_predictions")
        .select("*")
        .eq("id", prediction_id)
        .eq("user_id", user.sub)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Disease diagnosis not found")

    row = result.data
    name_key = "disease_name_ar" if locale == "ar" else "disease_name_fr"
    treatment_key = "treatment_ar" if locale == "ar" else "treatment_fr"
    return {
        **row,
        "disease_name": row.get(name_key) or row.get("disease_name_fr") or row.get("disease_key", ""),
        "treatment": row.get(treatment_key) or row.get("treatment_fr") or "",
    }
