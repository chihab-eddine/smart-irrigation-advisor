from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user
from app.models.schemas import TokenPayload, IrrigationRequest, IrrigationResponse
from app.models.database import get_supabase
from app.services import ai_service
from app.services.ai_service import AIUnavailableError
from app.services.irrigation_service import calculate_irrigation
from app.services.weather_service import get_weather_data
from app.config import get_settings

router = APIRouter()
settings = get_settings()


def _is_missing_ai_table_error(exc: Exception) -> bool:
    text = str(exc)
    return (
        "irrigation_ai_recommendations" in text
        and ("PGRST205" in text or "schema cache" in text or "Could not find the table" in text)
    )


def _harvest_estimate(crop_data: dict, planting_date) -> dict:
    """Estimate harvest from planting date + crop growth duration."""
    if not planting_date:
        return {
            "estimated_harvest_date": None,
            "days_to_harvest": None,
            "harvest_status": "unknown",
        }

    if isinstance(planting_date, str):
        try:
            planting_date = date.fromisoformat(planting_date[:10])
        except ValueError:
            return {
                "estimated_harvest_date": None,
                "days_to_harvest": None,
                "harvest_status": "unknown",
            }

    duration = int(crop_data.get("growth_duration_days") or 0)
    if duration <= 0:
        return {
            "estimated_harvest_date": None,
            "days_to_harvest": None,
            "harvest_status": "unknown",
        }

    harvest_date = planting_date + timedelta(days=duration)
    days_left = (harvest_date - date.today()).days
    if days_left < 0:
        status = "past"
    elif days_left <= 14:
        status = "soon"
    else:
        status = "planned"

    return {
        "estimated_harvest_date": harvest_date.isoformat(),
        "days_to_harvest": days_left,
        "harvest_status": status,
    }


def _localized_prediction(row: dict, locale: str = "fr") -> dict:
    name_key = "name_ar" if locale == "ar" else "name_fr"
    rec_key = "recommendation_ar" if locale == "ar" else "recommendation_fr"
    crop = row.get("crops") or {}
    region = row.get("moroccan_regions") or {}
    soil = row.get("soil_types") or {}
    harvest = _harvest_estimate(crop, row.get("planting_date"))

    return {
        **row,
        "crop_name": crop.get(name_key) or crop.get("name_fr") or "",
        "region_name": region.get(name_key) or region.get("name_fr") or "",
        "soil_type_name": soil.get(name_key) or soil.get("name_fr") or "",
        "recommendation": row.get(rec_key) or row.get("recommendation_fr") or "",
        "harvest_estimate": harvest,
    }


async def _current_update(row: dict, locale: str = "fr") -> dict:
    crop = row.get("crops") or {}
    region = row.get("moroccan_regions") or {}
    soil = row.get("soil_types") or {}
    planting_date = (
        date.fromisoformat(row["planting_date"][:10])
        if row.get("planting_date")
        else None
    )
    weather = await get_weather_data(
        region_id=row["region_id"],
        latitude=region["latitude"],
        longitude=region["longitude"],
    )
    result = calculate_irrigation(
        crop_data=crop,
        soil_data=soil,
        region_data=region,
        weather_data=weather,
        planting_date=planting_date,
        locale=locale,
    )
    return {
        "date": date.today().isoformat(),
        "growth_stage": result["growth_stage"],
        "eto_value": result["eto_value"],
        "etc_value": result["etc_value"],
        "recommended_water_mm": result["recommended_water_mm"],
        "alert_level": result["alert_level"],
        "recommendation": result["recommendation_ar" if locale == "ar" else "recommendation_fr"],
        "weather_summary": weather.get("current") or {},
        "harvest_estimate": _harvest_estimate(crop, planting_date),
    }


@router.post("/predict", response_model=IrrigationResponse)
async def predict_irrigation(
    request: IrrigationRequest,
    user: TokenPayload = Depends(get_current_user),
):
    """Generate irrigation recommendation based on crop, soil, region, and weather."""
    db = get_supabase()

    # Fetch reference data
    crop = db.table("crops").select("*").eq("id", request.crop_id).single().execute()
    if not crop.data:
        raise HTTPException(status_code=404, detail="Crop not found")

    soil = db.table("soil_types").select("*").eq("id", request.soil_type_id).single().execute()
    if not soil.data:
        raise HTTPException(status_code=404, detail="Soil type not found")

    region = db.table("moroccan_regions").select("*").eq("id", request.region_id).single().execute()
    if not region.data:
        raise HTTPException(status_code=404, detail="Region not found")

    # Get weather data (cached or fresh)
    weather = await get_weather_data(
        region_id=request.region_id,
        latitude=region.data["latitude"],
        longitude=region.data["longitude"],
    )

    # Calculate irrigation recommendation
    result = calculate_irrigation(
        crop_data=crop.data,
        soil_data=soil.data,
        region_data=region.data,
        weather_data=weather,
        planting_date=request.planting_date,
        locale=request.locale,
        land_size_m2=request.land_size_m2,
        irrigation_method=request.irrigation_method,
        pump_flow_rate_lph=request.pump_flow_rate_lph,
        drip_flow_rate_lph=request.drip_flow_rate_lph,
        num_emitters=request.num_emitters,
    )
    harvest = _harvest_estimate(crop.data, request.planting_date)

    # Save prediction to database
    prediction_data = {
        "user_id": user.sub,
        "crop_id": request.crop_id,
        "soil_type_id": request.soil_type_id,
        "region_id": request.region_id,
        "planting_date": str(request.planting_date) if request.planting_date else None,
        "growth_stage": result["growth_stage"],
        "weather_data": weather.get("current", {}),
        "eto_value": result["eto_value"],
        "etc_value": result["etc_value"],
        "recommended_water_mm": result["recommended_water_mm"],
        "recommendation_fr": result["recommendation_fr"],
        "recommendation_ar": result["recommendation_ar"],
        "alert_level": result["alert_level"],
        # System-aware fields (only persist when the user filled them in)
        "land_size_m2": result.get("land_size_m2") or None,
        "irrigation_method": result.get("irrigation_method") or None,
        "irrigation_efficiency": result.get("irrigation_efficiency") or None,
        "gross_water_mm": result.get("gross_water_mm") or None,
        "total_water_liters": result.get("total_water_liters") or None,
        "water_savings": result.get("water_savings") or None,
        "drip_info": result.get("drip_info") or None,
    }
    saved = db.table("irrigation_predictions").insert(prediction_data).execute()

    # Build response
    name_key = f"name_{request.locale}" if request.locale in ("fr", "ar") else "name_fr"
    rec_key = f"recommendation_{request.locale}" if request.locale in ("fr", "ar") else "recommendation_fr"

    return IrrigationResponse(
        id=saved.data[0]["id"] if saved.data else None,
        crop_name=crop.data.get(name_key, crop.data["name_fr"]),
        region_name=region.data.get(name_key, region.data["name_fr"]),
        soil_type_name=soil.data.get(name_key, soil.data["name_fr"]),
        growth_stage=result["growth_stage"],
        eto_value=result["eto_value"],
        etc_value=result["etc_value"],
        recommended_water_mm=result["recommended_water_mm"],
        recommendation=result[rec_key],
        alert_level=result["alert_level"],
        weather_summary=weather.get("current") or {
            "temperature": 0, "humidity": 0, "wind_speed": 0, "precipitation": 0,
        },
        forecast=weather.get("forecast") or [],
        created_at=saved.data[0]["created_at"] if saved.data else None,
        harvest_estimate=harvest,
        land_size_m2=result.get("land_size_m2", 0),
        irrigation_method=result.get("irrigation_method", ""),
        irrigation_efficiency=result.get("irrigation_efficiency", 0),
        gross_water_mm=result.get("gross_water_mm", 0),
        total_water_liters=result.get("total_water_liters", 0),
        water_savings=result.get("water_savings", {}),
        drip_info=result.get("drip_info", {}),
    )


@router.get("/history")
async def get_irrigation_history(
    user: TokenPayload = Depends(get_current_user),
    limit: int = 20,
    offset: int = 0,
):
    """Get user's irrigation prediction history."""
    db = get_supabase()
    result = (
        db.table("irrigation_predictions")
        .select(
            "*, crops(name_fr, name_ar), moroccan_regions(name_fr, name_ar), soil_types(name_fr, name_ar)",
            count="exact",
        )
        .eq("user_id", user.sub)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"data": result.data, "total": result.count or 0}


@router.get("/plantations/current")
async def get_current_plantation_updates(
    user: TokenPayload = Depends(get_current_user),
    locale: str = "fr",
    limit: int = 6,
):
    """Latest saved plantation groups with today's weather-based calculation."""
    db = get_supabase()
    result = (
        db.table("irrigation_predictions")
        .select("*, crops(*), moroccan_regions(*), soil_types(*)")
        .eq("user_id", user.sub)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )

    groups = {}
    for row in result.data or []:
        crop = row.get("crops") or {}
        region = row.get("moroccan_regions") or {}
        soil = row.get("soil_types") or {}
        key = (
            row.get("crop_id"),
            row.get("region_id"),
            row.get("soil_type_id"),
            row.get("planting_date") or "no-date",
        )
        if key not in groups:
            groups[key] = {
                "key": "|".join(str(part) for part in key),
                "latest": row,
                "crop": crop,
                "region": region,
                "soil": soil,
                "planting_date": row.get("planting_date"),
                "count": 0,
                "total_water": 0,
                "alerts": 0,
            }
        groups[key]["count"] += 1
        groups[key]["total_water"] += row.get("recommended_water_mm") or 0
        if row.get("alert_level") in ("warning", "critical"):
            groups[key]["alerts"] += 1

    name_key = "name_ar" if locale == "ar" else "name_fr"
    output = []
    for group in list(groups.values())[: max(1, min(limit, 20))]:
        latest = group["latest"]
        current = await _current_update(latest, locale)
        output.append({
            "key": group["key"],
            "latest_id": latest["id"],
            "crop_name": group["crop"].get(name_key) or group["crop"].get("name_fr") or "",
            "region_name": group["region"].get(name_key) or group["region"].get("name_fr") or "",
            "soil_type_name": group["soil"].get(name_key) or group["soil"].get("name_fr") or "",
            "planting_date": group["planting_date"],
            "analyses_count": group["count"],
            "historical_avg_water_mm": round(group["total_water"] / group["count"], 2),
            "historical_alerts": group["alerts"],
            "latest_saved": {
                "created_at": latest.get("created_at"),
                "recommended_water_mm": latest.get("recommended_water_mm"),
                "alert_level": latest.get("alert_level"),
                "growth_stage": latest.get("growth_stage"),
            },
            "current_update": current,
        })

    return {"data": output}


@router.get("/{prediction_id}")
async def get_irrigation_prediction(
    prediction_id: str,
    locale: str = "fr",
    user: TokenPayload = Depends(get_current_user),
):
    """Consult one saved irrigation calculation."""
    db = get_supabase()
    result = (
        db.table("irrigation_predictions")
        .select(
            "*, crops(*), moroccan_regions(*), soil_types(*)"
        )
        .eq("id", prediction_id)
        .eq("user_id", user.sub)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Irrigation calculation not found")
    return {
        **_localized_prediction(result.data, locale),
        "current_update": await _current_update(result.data, locale),
    }


@router.get("/{prediction_id}/ai-recommendation")
async def get_daily_ai_recommendation(
    prediction_id: str,
    locale: str = "fr",
    user: TokenPayload = Depends(get_current_user),
):
    """
    Return the Gemini recommendation for this calculation for today.
    If today's recommendation does not exist yet, generate it from the saved
    planting context + fresh weather, then persist it.
    """
    if not ai_service.is_available():
        raise HTTPException(status_code=503, detail="Gemini is not configured on this server")

    db = get_supabase()
    prediction_res = (
        db.table("irrigation_predictions")
        .select("*, crops(*), moroccan_regions(*), soil_types(*)")
        .eq("id", prediction_id)
        .eq("user_id", user.sub)
        .maybe_single()
        .execute()
    )
    if not prediction_res.data:
        raise HTTPException(status_code=404, detail="Irrigation calculation not found")

    today = date.today().isoformat()
    ai_table_available = True
    existing = None
    try:
        existing = (
            db.table("irrigation_ai_recommendations")
            .select("*")
            .eq("prediction_id", prediction_id)
            .eq("user_id", user.sub)
            .eq("recommendation_date", today)
            .eq("locale", locale)
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        if not _is_missing_ai_table_error(exc):
            raise
        ai_table_available = False

    if existing and existing.data:
        return {
            "text": existing.data["text"],
            "model": existing.data.get("model") or settings.gemini_model,
            "available": True,
            "recommendation_date": existing.data["recommendation_date"],
            "cached": True,
            "context": existing.data.get("context") or {},
        }

    row = prediction_res.data
    crop = row.get("crops") or {}
    region = row.get("moroccan_regions") or {}
    soil = row.get("soil_types") or {}
    name_key = "name_ar" if locale == "ar" else "name_fr"

    weather = await get_weather_data(
        region_id=row["region_id"],
        latitude=region["latitude"],
        longitude=region["longitude"],
    )
    planting_date = (
        date.fromisoformat(row["planting_date"][:10])
        if row.get("planting_date")
        else None
    )
    daily = calculate_irrigation(
        crop_data=crop,
        soil_data=soil,
        region_data=region,
        weather_data=weather,
        planting_date=planting_date,
        locale=locale,
    )
    harvest = _harvest_estimate(crop, planting_date)
    context = {
        "crop_name": crop.get(name_key) or crop.get("name_fr"),
        "region_name": region.get(name_key) or region.get("name_fr"),
        "soil_type_name": soil.get(name_key) or soil.get("name_fr"),
        "growth_stage": daily["growth_stage"],
        "recommended_water_mm": daily["recommended_water_mm"],
        "eto_value": daily["eto_value"],
        "etc_value": daily["etc_value"],
        "alert_level": daily["alert_level"],
        "weather_summary": weather.get("current") or {},
        "planting_date": row.get("planting_date"),
        **harvest,
    }

    try:
        text = ai_service.irrigation_tips(context, locale=locale)
    except AIUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    saved_row = {}
    if ai_table_available:
        try:
            saved = (
                db.table("irrigation_ai_recommendations")
                .insert({
                    "prediction_id": prediction_id,
                    "user_id": user.sub,
                    "recommendation_date": today,
                    "locale": locale,
                    "model": settings.gemini_model,
                    "text": text,
                    "context": context,
                })
                .execute()
            )
            saved_row = saved.data[0] if saved.data else {}
        except Exception as exc:
            if not _is_missing_ai_table_error(exc):
                raise
            ai_table_available = False

    return {
        "text": text,
        "model": settings.gemini_model,
        "available": True,
        "recommendation_date": saved_row.get("recommendation_date", today),
        "cached": False,
        "saved": ai_table_available,
        "context": context,
    }
