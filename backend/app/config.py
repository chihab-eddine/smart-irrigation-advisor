from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Supabase
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""

    # Open-Meteo
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"

    # Gemini (Google AI Studio)
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Resend (transactional email)
    resend_api_key: str = ""
    resend_from_email: str = "Smart Irrigation <onboarding@resend.dev>"

    # Reminders cron — secret used by the scheduler to call /api/reminders/send-daily
    reminders_secret: str = ""

    # Public app URL (used in email links)
    public_app_url: str = "http://localhost:3000"

    # CORS
    allowed_origins: str = "http://localhost:3000"

    # App
    app_name: str = "Smart Irrigation Advisor API"
    debug: bool = False
    max_upload_size_mb: int = 5

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        """Accept common deployment env labels that may leak into DEBUG."""
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"dev", "development"}:
                return True
        return value

    class Config:
        env_file = ".env"
        case_sensitive = False
        # Ignore env vars that aren't declared on this model. Lets us drop
        # reference values into .env (e.g. SMTP creds for Supabase dashboard)
        # without crashing the backend on startup.
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
