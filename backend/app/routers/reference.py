from fastapi import APIRouter, Depends
from app.models.database import get_supabase
from app.models.schemas import CropResponse, SoilTypeResponse, RegionResponse

router = APIRouter()


@router.get("/crops", response_model=list[CropResponse])
async def get_crops():
    """Get all available crops."""
    db = get_supabase()
    result = db.table("crops").select("*").order("name_fr").execute()
    return result.data


@router.get("/soil-types", response_model=list[SoilTypeResponse])
async def get_soil_types():
    """Get all soil types."""
    db = get_supabase()
    result = db.table("soil_types").select("*").order("name_fr").execute()
    return result.data


@router.get("/regions", response_model=list[RegionResponse])
async def get_regions():
    """Get all Moroccan regions."""
    db = get_supabase()
    result = db.table("moroccan_regions").select("*").order("name_fr").execute()
    return result.data
