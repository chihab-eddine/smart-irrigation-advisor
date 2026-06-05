"""
Gemini-powered advisory helpers.

Each function takes structured context, builds a constrained bilingual prompt,
and returns plain text. All calls are guarded — if the Gemini client is missing
or the API errors, the caller gets a clear `AIUnavailableError` instead of a
crashed endpoint.
"""
from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class AIUnavailableError(RuntimeError):
    """Raised when the Gemini client can't service the request."""


_client = None
_client_attempted = False


def _get_client():
    global _client, _client_attempted
    if _client_attempted:
        return _client
    _client_attempted = True

    if not settings.gemini_api_key:
        logger.info("GEMINI_API_KEY not set — AI features disabled")
        return None
    try:
        from google import genai
        _client = genai.Client(api_key=settings.gemini_api_key)
    except Exception as exc:
        logger.exception("Could not initialize Gemini client: %s", exc)
        _client = None
    return _client


def is_available() -> bool:
    return _get_client() is not None


# ---------------------------------------------------------------------------
# Low-level call
# ---------------------------------------------------------------------------
def _generate(prompt: str, *, system: str | None = None, max_tokens: int = 600) -> str:
    client = _get_client()
    if client is None:
        raise AIUnavailableError("Gemini is not configured on this server")

    try:
        # google-genai 1.x
        from google.genai import types
        kwargs = dict(
            temperature=0.4,
            max_output_tokens=max_tokens,
            system_instruction=system,
        )
        # Disable thinking on Gemini 2.5 — these are short advisory replies, not
        # reasoning tasks, and thinking tokens would eat the max_output budget.
        try:
            kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
        except (AttributeError, TypeError):
            # Older SDKs / non-2.5 models — silently fall back to default.
            pass
        config = types.GenerateContentConfig(**kwargs)
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=config,
        )
        text = (resp.text or "").strip()
        if not text:
            raise AIUnavailableError("Empty response from Gemini")
        return text
    except AIUnavailableError:
        raise
    except Exception as exc:
        logger.exception("Gemini call failed: %s", exc)
        raise AIUnavailableError(f"Gemini error: {exc}")


# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------
LANG_NAME = {"fr": "French", "ar": "Modern Standard Arabic (العربية الفصحى)"}

BASE_SYSTEM = (
    "You are an agronomy assistant for Moroccan farmers. "
    "Be concise, practical, and culturally aware (mention dawn watering, "
    "drip vs flood irrigation, Moroccan regional climate quirks when relevant). "
    "Never invent numbers — only use the figures provided. "
    "Never contradict the scientific recommendation provided. "
    "Refuse politely if asked about topics outside agriculture, weather, "
    "irrigation, plant diseases, or soil."
)


def irrigation_tips(context: dict[str, Any], locale: str = "fr") -> str:
    """Practical tips that build ON TOP of the FAO-56 recommendation."""
    lang = LANG_NAME.get(locale, LANG_NAME["fr"])
    weather = context.get("weather_summary") or {}
    prompt = f"""
A Moroccan farmer just received an irrigation recommendation from a FAO-56 Penman-Monteith model.
Write 3 to 5 short, practical tips in {lang} that complement (do NOT replace or contradict) the recommendation.

Context:
- Crop: {context.get('crop_name', '—')}
- Region: {context.get('region_name', '—')}
- Soil: {context.get('soil_type_name', '—')}
- Growth stage: {context.get('growth_stage', '—')}
- Recommended irrigation: {context.get('recommended_water_mm', 0)} mm/day
- ETo (reference evapotranspiration): {context.get('eto_value', 0)} mm
- ETc (crop evapotranspiration): {context.get('etc_value', 0)} mm
- Alert level: {context.get('alert_level', 'normal')}
- Planting date: {context.get('planting_date', '—')}
- Estimated harvest date: {context.get('estimated_harvest_date', '—')}
- Estimated days to harvest: {context.get('days_to_harvest', '—')}
- Today's weather: temperature {weather.get('temperature', '?')}°C, humidity {weather.get('humidity', '?')}%, wind {weather.get('wind_speed', '?')} km/h, rain {weather.get('precipitation', '?')} mm

Required output format:
- A bulleted list, each bullet ≤2 sentences.
- Cover at least: best watering time of day, irrigation method suited to crop+soil, what to inspect today, one risk to avoid, and harvest timing if an estimate is provided.
- Pure prose, no markdown headers, no preamble, no closing remark.
- Respond in {lang}.
"""
    return _generate(prompt.strip(), system=BASE_SYSTEM, max_tokens=500)


def disease_tips(context: dict[str, Any], locale: str = "fr") -> str:
    """Region-aware action steps on top of the standard treatment string."""
    lang = LANG_NAME.get(locale, LANG_NAME["fr"])
    prompt = f"""
A Moroccan farmer uploaded a leaf photo and the disease classifier returned the diagnosis below.
Write 3 to 4 short, practical action items in {lang}, complementing (not replacing) the standard treatment.

Diagnosis:
- Disease: {context.get('disease_name', context.get('disease_key', '—'))}
- Confidence: {round((context.get('confidence_score') or 0) * 100, 1)}%
- Crop: {context.get('crop_type', '—')}
- Standard treatment provided: {context.get('treatment', '—')}

Required output format:
- A bulleted list, each bullet ≤2 sentences.
- Cover: prevention for neighboring plants, application timing, what NOT to do,
  when to escalate to a local agronomist (ONSSA / DRA).
- Respond in {lang}. No headers, no preamble.
"""
    return _generate(prompt.strip(), system=BASE_SYSTEM, max_tokens=500)


def daily_insight(context: dict[str, Any], locale: str = "fr") -> str:
    """A 2-3 sentence personal summary for the dashboard."""
    lang = LANG_NAME.get(locale, LANG_NAME["fr"])
    recent = context.get("recent_irrigations") or []
    alerts = context.get("active_alerts") or []
    weather = context.get("weather") or {}

    recent_str = (
        "\n".join(
            f"  - {r.get('crop')} in {r.get('region')}: {r.get('water_mm')} mm ({r.get('alert')})"
            for r in recent[:5]
        )
        or "  (no recent analyses)"
    )
    alerts_str = (
        "\n".join(
            f"  - {a.get('alert')}: {a.get('crop')} / {a.get('region')} → {a.get('water_mm')} mm"
            for a in alerts[:5]
        )
        or "  (no active alerts)"
    )

    prompt = f"""
You are writing a one-paragraph daily summary for a Moroccan farmer's dashboard.

User context:
- Name: {context.get('user_name', 'Friend')}
- Date: {context.get('today', '—')}
- Today's weather (default region): {weather.get('summary', '—')}

Recent irrigation analyses:
{recent_str}

Active alerts:
{alerts_str}

Required output:
- 2 to 3 sentences in {lang}.
- Mention if any action is needed today.
- Friendly, factual tone. Do NOT invent numbers.
- No bullet list. No preamble.
"""
    return _generate(prompt.strip(), system=BASE_SYSTEM, max_tokens=250)


def chat_reply(messages: list[dict[str, str]], locale: str = "fr") -> str:
    """
    Stateless chat — caller passes the running history as
    `[{role: 'user'|'assistant', content: '...'}, ...]`.
    Returns the assistant's next reply text.
    """
    lang = LANG_NAME.get(locale, LANG_NAME["fr"])
    system = (
        BASE_SYSTEM
        + f" Always reply in {lang}. Keep replies under 5 sentences unless the user explicitly asks for detail."
    )

    client = _get_client()
    if client is None:
        raise AIUnavailableError("Gemini is not configured on this server")

    # Flatten the history into a single prompt — Gemini's `contents` accepts
    # parts/roles too, but for stateless single-shot replies a flat string
    # works fine and avoids SDK version drift.
    convo = []
    for m in messages[-12:]:  # last 12 turns is plenty
        role = m.get("role", "user")
        prefix = "User" if role == "user" else "Assistant"
        content = (m.get("content") or "").strip()
        if content:
            convo.append(f"{prefix}: {content}")
    convo.append("Assistant:")
    prompt = "\n\n".join(convo)
    return _generate(prompt, system=system, max_tokens=500)
