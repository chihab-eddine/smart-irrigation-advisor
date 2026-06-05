from fastapi import APIRouter, HTTPException

from app.services.weather_service import get_weather_data
from app.models.database import get_supabase

router = APIRouter()


@router.get("/{region_id}")
async def get_weather(region_id: int):
    """Get weather forecast for a Moroccan region (cached)."""
    db = get_supabase()

    region = (
        db.table("moroccan_regions")
        .select("*")
        .eq("id", region_id)
        .maybe_single()
        .execute()
    )
    if not region or not region.data:
        raise HTTPException(status_code=404, detail="Region not found")

    weather = await get_weather_data(
        region_id=region_id,
        latitude=region.data["latitude"],
        longitude=region.data["longitude"],
    )

    return {"region": region.data, "weather": weather}
