"""
Shared HTML layout for all transactional emails sent via Resend.

`render_layout()` wraps arbitrary inner HTML in a branded shell (header, body,
footer, RTL/LTR direction). All other render_* helpers in this module produce
inner-HTML strings and feed them through render_layout().

Email clients are 20 years behind the web — only inline CSS works reliably,
no flexbox/grid, no custom fonts, no media queries past min/max-width. Keep
markup boring and tested.
"""
from __future__ import annotations

BRAND_GREEN = "#15803d"
BRAND_GREEN_DARK = "#166534"
BG = "#f3f4f6"
CARD_BG = "#ffffff"
BORDER = "#e5e7eb"
TEXT = "#111827"
MUTED = "#6b7280"
FOOTER_BG = "#f9fafb"


def render_layout(
    *,
    locale: str,
    preheader: str,
    inner_html: str,
    footer_html: str | None = None,
) -> str:
    """Wrap inner_html in the branded email shell.

    Args:
        locale: "fr" or "ar" — controls text direction.
        preheader: short hidden text shown by Gmail/Outlook in the inbox preview.
        inner_html: the body content (already-formatted HTML).
        footer_html: optional override; falls back to the localized default.
    """
    direction = "rtl" if locale == "ar" else "ltr"
    align = "right" if locale == "ar" else "left"
    if footer_html is None:
        footer_html = _default_footer(locale)

    return f"""<!doctype html>
<html lang="{locale}" dir="{direction}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Smart Irrigation Advisor</title>
  </head>
  <body style="margin:0;padding:0;background:{BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:{TEXT};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      {preheader}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{BG};padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:{CARD_BG};border:1px solid {BORDER};border-radius:10px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,{BRAND_GREEN} 0%,{BRAND_GREEN_DARK} 100%);padding:24px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="text-align:{align};">
                      <div style="font-size:18px;font-weight:600;color:#ffffff;letter-spacing:.2px;">
                        Smart Irrigation Advisor
                      </div>
                      <div style="margin-top:2px;font-size:12px;color:#bbf7d0;">
                        {_tagline(locale)}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;text-align:{align};">
                {inner_html}
              </td>
            </tr>
            <tr>
              <td style="background:{FOOTER_BG};border-top:1px solid {BORDER};padding:18px 32px;text-align:{align};">
                <div style="font-size:11px;color:{MUTED};line-height:1.6;">
                  {footer_html}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def render_button(label: str, href: str) -> str:
    """A bulletproof CTA button — table-based for Outlook compatibility."""
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td style="border-radius:6px;background:{BRAND_GREEN};">
      <a href="{href}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
        {label}
      </a>
    </td>
  </tr>
</table>"""


def render_paragraph(text: str, *, muted: bool = False, size: int = 14) -> str:
    color = MUTED if muted else TEXT
    return (
        f'<p style="margin:0 0 12px;font-size:{size}px;line-height:1.6;color:{color};">'
        f"{text}</p>"
    )


def render_divider() -> str:
    return f'<hr style="border:none;border-top:1px solid {BORDER};margin:20px 0;">'


def render_link_fallback(label: str, href: str) -> str:
    """Plain-text link the user can copy if the button doesn't work."""
    return (
        f'<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:{MUTED};word-break:break-all;">'
        f"{label}<br>"
        f'<a href="{href}" style="color:{BRAND_GREEN};text-decoration:underline;">{href}</a>'
        "</p>"
    )


def _tagline(locale: str) -> str:
    return "مستشار الري الذكي للفلاحين المغاربة" if locale == "ar" else "Irrigation intelligente pour l'agriculture marocaine"


def _default_footer(locale: str) -> str:
    if locale == "ar":
        return (
            "تم إرسال هذه الرسالة من تطبيق مستشار الري الذكي.<br>"
            "لإلغاء الإشعارات، عدّل تفضيلاتك في صفحة الملف الشخصي."
        )
    return (
        "Cet email a été envoyé par Smart Irrigation Advisor.<br>"
        "Pour désactiver les notifications, modifiez vos préférences dans votre profil."
    )
