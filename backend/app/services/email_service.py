"""
Thin Resend wrapper for transactional emails.

Used by /api/reminders/send-daily. Falls back to a no-op if RESEND_API_KEY is
unset, so the rest of the app keeps working without an email provider.
"""
from __future__ import annotations

import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class EmailUnavailableError(RuntimeError):
    """Raised when no email provider is configured."""


_client_attempted = False
_client_ok = False


def _init() -> bool:
    """Idempotent client setup. Returns True if Resend is usable."""
    global _client_attempted, _client_ok
    if _client_attempted:
        return _client_ok
    _client_attempted = True
    if not settings.resend_api_key:
        logger.info("RESEND_API_KEY not set — email features disabled")
        return False
    try:
        import resend
        resend.api_key = settings.resend_api_key
        _client_ok = True
    except Exception as exc:
        logger.exception("Could not initialize Resend: %s", exc)
        _client_ok = False
    return _client_ok


def is_available() -> bool:
    return _init()


def send_email(*, to: str, subject: str, html: str, text: Optional[str] = None) -> str:
    """Send one email. Returns the Resend message ID. Raises on failure."""
    if not _init():
        raise EmailUnavailableError("Email provider is not configured")

    import resend
    payload = {
        "from": settings.resend_from_email,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    resp = resend.Emails.send(payload)
    msg_id = (resp or {}).get("id") if isinstance(resp, dict) else getattr(resp, "id", None)
    logger.info("Sent email to %s (id=%s)", to, msg_id)
    return msg_id or ""


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------
def render_daily_reminder(*, name: str, locale: str, summary_text: str, app_url: str) -> tuple[str, str, str]:
    """Build subject + HTML body + plaintext for the daily reminder."""
    from app.services.email_layouts import (
        render_layout, render_button, render_paragraph, render_divider,
    )
    ar = locale == "ar"
    if ar:
        subject = "تذكير الري لهذا اليوم — مستشار الري الذكي"
        preheader = "ملخص حالة محصولك اليوم وكمية الماء الموصى بها."
        greeting = f"مرحبًا {name} 👋"
        intro = "إليك ملخص الري لهذا اليوم بناءً على الطقس الحالي ومحصولك:"
        cta = "افتح لوحة التحكم"
        tip_title = "نصيحة اليوم"
    else:
        subject = "Votre point d'irrigation du jour — Smart Irrigation"
        preheader = "Résumé de l'état de votre culture et besoin en eau du jour."
        greeting = f"Bonjour {name} 👋"
        intro = "Voici votre point quotidien d'irrigation, calculé avec la météo actuelle :"
        cta = "Ouvrir le tableau de bord"
        tip_title = "Conseil du jour"

    # The summary may be multi-paragraph (irrigation recommendation + AI tip).
    # Render the first paragraph as the main body, the rest as a styled tip box.
    parts = [p.strip() for p in summary_text.split("\n\n") if p.strip()]
    main_text = parts[0] if parts else summary_text
    tip_text = "\n\n".join(parts[1:]) if len(parts) > 1 else ""

    inner = render_paragraph(greeting, size=16)
    inner += render_paragraph(intro, muted=True, size=13)
    inner += (
        f'<div style="padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;'
        f'border-radius:6px;font-size:14px;line-height:1.6;color:#166534;'
        f'white-space:pre-line;">{main_text}</div>'
    )
    if tip_text:
        inner += render_divider()
        inner += render_paragraph(
            f'<strong>{tip_title}</strong>', size=12
        )
        inner += (
            f'<div style="font-size:13px;line-height:1.6;color:#374151;'
            f'white-space:pre-line;">{tip_text}</div>'
        )
    inner += render_button(cta, app_url)

    html = render_layout(locale=locale, preheader=preheader, inner_html=inner)
    text = f"{greeting}\n\n{main_text}" + (f"\n\n{tip_title}: {tip_text}" if tip_text else "")
    text += f"\n\n{cta}: {app_url}"
    return subject, html, text
