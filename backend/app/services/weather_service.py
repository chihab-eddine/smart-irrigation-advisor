"""
Weather Service — Open-Meteo API integration with Supabase caching.
"""
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.config import get_settings
from app.models.database import get_supabase

logger = logging.getLogger(__name__)
settings = get_settings()


def _empty_weather() -> dict:
    """Safe default shape so callers (irrigation service) never crash."""
    return {
        "current": {
            "temperature": 0,
            "humidity": 0,
            "wind_speed": 0,
            "precipitation": 0,
        },
        "forecast": [],
        "fetched_at": None,
        "stale": True,
    }


def _latest_cache(db, region_id: int) -> dict | None:
    """Return the most recent cached entry for a region, even if expired."""
    try:
        result = (
            db.table("weather_cache")
            .select("*")
            .eq("region_id", region_id)
            .order("fetched_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0].get("forecast_data")
    except Exception as exc:
        logger.warning("Reading weather_cache failed: %s", exc)
    return None


async def get_weather_data(region_id: int, latitude: float, longitude: float) -> dict:
    """
    Returns current conditions and 7-day forecast.
    Strategy:
      1. Return fresh cache if available.
      2. Else fetch from Open-Meteo and cache it.
      3. On API failure, fall back to the most recent cache entry (even if expired).
      4. As a last resort, return an empty shape so callers don't crash.
    """
    db = get_supabase()

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    # 1. Try fresh cache
    try:
        cached = (
            db.table("weather_cache")
            .select("forecast_data")
            .eq("region_id", region_id)
            .gt("expires_at", now_iso)
            .order("fetched_at", desc=True)
            .limit(1)
            .execute()
        )
        if cached.data:
            return cached.data[0]["forecast_data"]
    except Exception as exc:
        logger.warning("weather_cache lookup failed: %s", exc)

    # 2. Fetch fresh from Open-Meteo
    try:
        weather = await fetch_from_open_meteo(latitude, longitude)
    except Exception as exc:
        logger.warning("Open-Meteo fetch failed for region %s: %s", region_id, exc)
        stale = _latest_cache(db, region_id)
        if stale:
            stale["stale"] = True
            return stale
        return _empty_weather()

    # 3. Cache the fresh result
    try:
        db.table("weather_cache").insert({
            "region_id": region_id,
            "forecast_data": weather,
            "fetched_at": now_iso,
            "expires_at": (now + timedelta(hours=1)).isoformat(),
        }).execute()

        # Best-effort cleanup of expired rows for this region
        db.table("weather_cache").delete().eq("region_id", region_id).lt("expires_at", now_iso).execute()
    except Exception as exc:
        logger.warning("weather_cache write failed: %s", exc)

    return weather


async def fetch_from_open_meteo(latitude: float, longitude: float) -> dict:
    """Fetch weather data from the Open-Meteo API."""
    url = f"{settings.open_meteo_base_url}/forecast"

    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": [
            "temperature_2m",
            "relative_humidity_2m",
            "wind_speed_10m",
            "precipitation",
        ],
        "daily": [
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "wind_speed_10m_max",
            "shortwave_radiation_sum",
            "et0_fao_evapotranspiration",
            "relative_humidity_2m_mean",
        ],
        "timezone": "Africa/Casablanca",
        "forecast_days": 7,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    current = data.get("current", {})
    daily = data.get("daily", {})

    def _at(key: str, i: int, default=0):
        arr = daily.get(key) or []
        return arr[i] if i < len(arr) else default

    forecast = []
    for i, date_str in enumerate(daily.get("time", [])):
        forecast.append({
            "date": date_str,
            "temp_max": _at("temperature_2m_max", i),
            "temp_min": _at("temperature_2m_min", i),
            "precipitation": _at("precipitation_sum", i),
            "wind_speed_max": _at("wind_speed_10m_max", i),
            "radiation": _at("shortwave_radiation_sum", i),
            "eto": _at("et0_fao_evapotranspiration", i),
            "humidity_mean": _at("relative_humidity_2m_mean", i),
        })

    return {
        "current": {
            "temperature": current.get("temperature_2m", 0),
            "humidity": current.get("relative_humidity_2m", 0),
            "wind_speed": current.get("wind_speed_10m", 0),
            "precipitation": current.get("precipitation", 0),
        },
        "forecast": forecast,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "stale": False,
    }
