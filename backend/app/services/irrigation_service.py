"""
Irrigation Service — FAO Penman-Monteith based irrigation recommendation engine.
"""
from datetime import date
from typing import Optional


# Application efficiency by irrigation system (FAO-56 standard ranges).
# Determines how much water you must APPLY to deliver one unit of ETc to the crop.
IRRIGATION_EFFICIENCY = {
    "drip":      0.90,   # ~10% application loss
    "sprinkler": 0.75,   # ~25% loss (wind drift, evaporation)
    "surface":   0.55,   # ~45% loss (deep percolation, runoff)
}
DEFAULT_EFFICIENCY = 1.0   # used when no method specified — gives the raw net need


def calculate_irrigation(
    crop_data,
    soil_data,
    region_data,
    weather_data,
    planting_date=None,
    locale="fr",
    land_size_m2: Optional[float] = None,
    irrigation_method: Optional[str] = None,
    pump_flow_rate_lph: Optional[float] = None,
    drip_flow_rate_lph: Optional[float] = None,
    num_emitters: Optional[int] = None,
):
    forecast = weather_data.get("forecast", []) or []

    if not forecast:
        return {
            "growth_stage": "unknown",
            "eto_value": 0,
            "etc_value": 0,
            "recommended_water_mm": 0,
            "recommendation_fr": "Données météo non disponibles. Réessayez plus tard.",
            "recommendation_ar": "البيانات الجوية غير متوفرة. أعد المحاولة لاحقاً.",
            "alert_level": "normal",
            "land_size_m2": float(land_size_m2 or 0),
            "irrigation_method": (irrigation_method or "").lower(),
            "irrigation_efficiency": 0,
            "gross_water_mm": 0,
            "total_water_liters": 0,
            "water_savings": {},
            "drip_info": {},
        }

    today_forecast = forecast[0] or {}
    eto = float(today_forecast.get("eto") or 4.0)

    growth_stage, kc = _estimate_growth_stage(crop_data, planting_date)
    etc = kc * eto

    total_precip = sum(float(day.get("precipitation") or 0) for day in forecast[:3])
    effective_rain = total_precip * 0.8
    daily_rain = effective_rain / 3 if total_precip > 0 else 0

    net_irrigation = max(0.0, etc - daily_rain)

    dry_days = sum(1 for day in forecast if float(day.get("precipitation") or 0) < 0.5)
    max_temp = max((float(day.get("temp_max") or 0) for day in forecast), default=0)
    is_drought = dry_days >= 5 and max_temp > 35

    if is_drought:
        alert_level = "critical"
    elif net_irrigation > 6:
        alert_level = "warning"
    else:
        alert_level = "normal"

    crop_fr = crop_data.get("name_fr", "")
    crop_ar = crop_data.get("name_ar", "")

    rec_fr = _build_fr(net_irrigation, growth_stage, is_drought, crop_fr, eto, etc, daily_rain)
    rec_ar = _build_ar(net_irrigation, growth_stage, is_drought, crop_ar, eto, etc, daily_rain)

    # ----- System-aware extensions -----
    method_key = (irrigation_method or "").strip().lower()
    if method_key in ("flood", "surface/flood"):
        method_key = "surface"
    efficiency = IRRIGATION_EFFICIENCY.get(method_key, DEFAULT_EFFICIENCY)

    gross_water_mm = net_irrigation / efficiency if efficiency > 0 else 0.0

    # 1 mm of water over 1 m² == 1 liter. So total liters = gross_mm × area.
    area = float(land_size_m2) if land_size_m2 and land_size_m2 > 0 else 0.0
    total_water_liters = gross_water_mm * area

    # Build a 3-way comparison so the UI can show savings vs other methods.
    water_savings = {}
    if area > 0 and net_irrigation > 0:
        per_method_liters = {
            m: round((net_irrigation / e) * area, 1) for m, e in IRRIGATION_EFFICIENCY.items()
        }
        worst = max(per_method_liters.values())
        chosen_liters = per_method_liters.get(method_key, worst)
        water_savings = {
            "per_method_liters": per_method_liters,
            "worst_method_liters": worst,
            "chosen_liters": chosen_liters,
            "saved_vs_worst_liters": round(worst - chosen_liters, 1),
            "saved_vs_worst_pct": round((worst - chosen_liters) / worst * 100, 1) if worst > 0 else 0,
        }

    # Drip-specific: irrigation duration in hours + per-emitter share + pump capacity check.
    drip_info = {}
    if method_key == "drip" and total_water_liters > 0:
        n_e = int(num_emitters) if num_emitters and num_emitters > 0 else 0
        df = float(drip_flow_rate_lph) if drip_flow_rate_lph and drip_flow_rate_lph > 0 else 0.0
        pf = float(pump_flow_rate_lph) if pump_flow_rate_lph and pump_flow_rate_lph > 0 else 0.0
        liters_per_emitter = total_water_liters / n_e if n_e > 0 else 0.0
        total_flow_needed = n_e * df   # L/h the system must deliver simultaneously
        duration_hours = (
            total_water_liters / total_flow_needed if total_flow_needed > 0 else 0.0
        )
        drip_info = {
            "num_emitters": n_e,
            "drip_flow_rate_lph": df,
            "pump_flow_rate_lph": pf,
            "liters_per_emitter": round(liters_per_emitter, 2),
            "total_flow_needed_lph": round(total_flow_needed, 1),
            "duration_hours": round(duration_hours, 2),
            "pump_ok": (pf >= total_flow_needed) if pf > 0 and total_flow_needed > 0 else None,
        }

    return {
        "growth_stage": growth_stage,
        "eto_value": round(eto, 2),
        "etc_value": round(etc, 2),
        "recommended_water_mm": round(net_irrigation, 2),
        "recommendation_fr": rec_fr,
        "recommendation_ar": rec_ar,
        "alert_level": alert_level,
        # System-aware
        "land_size_m2": round(area, 2),
        "irrigation_method": method_key,
        "irrigation_efficiency": round(efficiency, 2) if method_key else 0,
        "gross_water_mm": round(gross_water_mm, 2),
        "total_water_liters": round(total_water_liters, 1),
        "water_savings": water_savings,
        "drip_info": drip_info,
    }


def _estimate_growth_stage(crop_data, planting_date):
    kc_i = float(crop_data.get("kc_initial", 0.3))
    kc_m = float(crop_data.get("kc_mid", 1.0))
    kc_l = float(crop_data.get("kc_late", 0.7))
    dur = int(crop_data.get("growth_duration_days", 120))

    if not planting_date:
        return "mid-season", kc_m

    days = (date.today() - planting_date).days
    if days < 0:
        return "pre-planting", kc_i

    r = days / dur if dur > 0 else 0
    if r < 0.20:
        return "initial", kc_i
    elif r < 0.50:
        kc = kc_i + (kc_m - kc_i) * ((r - 0.20) / 0.30)
        return "development", round(kc, 3)
    elif r < 0.80:
        return "mid-season", kc_m
    elif r < 1.2:
        kc = kc_m + (kc_l - kc_m) * ((r - 0.80) / 0.40)
        return "late", round(kc, 3)
    else:
        return "harvest", kc_l * 0.5


STAGES_FR = {
    "pre-planting": "Pré-plantation",
    "initial": "Initial",
    "development": "Développement",
    "mid-season": "Mi-saison",
    "late": "Fin de saison",
    "harvest": "Récolte",
}
STAGES_AR = {
    "pre-planting": "قبل الزراعة",
    "initial": "المرحلة الأولية",
    "development": "مرحلة النمو",
    "mid-season": "منتصف الموسم",
    "late": "نهاية الموسم",
    "harvest": "الحصاد",
}


def _build_fr(net, stage, drought, crop, eto, etc, rain):
    lines = []
    if drought:
        lines.append("Alerte sécheresse détectée dans votre région.")
    lines.append(f"Culture : {crop} — Stade : {STAGES_FR.get(stage, stage)}")
    lines.append(f"ETo : {eto:.1f} mm/jour | ETc : {etc:.1f} mm/jour")
    if rain > 0:
        lines.append(f"Pluie efficace : {rain:.1f} mm/jour")
    if net <= 0:
        lines.append("Pas d'irrigation nécessaire aujourd'hui.")
    elif net < 3:
        lines.append(f"Irrigation légère recommandée : {net:.1f} mm.")
    elif net < 6:
        lines.append(f"Irrigation modérée recommandée : {net:.1f} mm.")
    else:
        lines.append(f"Irrigation importante recommandée : {net:.1f} mm.")
    return "\n".join(lines)


def _build_ar(net, stage, drought, crop, eto, etc, rain):
    lines = []
    if drought:
        lines.append("تم رصد تنبيه جفاف في منطقتك.")
    lines.append(f"المحصول: {crop} — المرحلة: {STAGES_AR.get(stage, stage)}")
    lines.append(f"ETo: {eto:.1f} مم/يوم | ETc: {etc:.1f} مم/يوم")
    if rain > 0:
        lines.append(f"الأمطار الفعالة: {rain:.1f} مم/يوم")
    if net <= 0:
        lines.append("لا حاجة للري اليوم.")
    elif net < 3:
        lines.append(f"يوصى بريّ خفيف: {net:.1f} مم.")
    elif net < 6:
        lines.append(f"يوصى بريّ متوسط: {net:.1f} مم.")
    else:
        lines.append(f"يوصى بريّ مكثف: {net:.1f} مم.")
    return "\n".join(lines)
