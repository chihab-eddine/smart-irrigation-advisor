import logging

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import (
    admin,
    ai,
    blog,
    contact,
    disease,
    irrigation,
    newsletter,
    preferences,
    reference,
    reminders,
    weather,
)
from app.services.ai_service import is_available as ai_available
from app.services.disease_service import model_status
from app.services.email_service import is_available as email_available

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("app")

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Smart Irrigation & Crop Disease Detection API for Moroccan Agriculture",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — list of explicit origins (never "*" because we send credentials)
origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip() and o.strip() != "*"]
allow_localhost_dev = any(
    origin.startswith(("http://localhost:", "http://127.0.0.1:"))
    for origin in origins
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=(
        r"^https?://(localhost|127\.0\.0\.1):\d+$"
        if allow_localhost_dev
        else None
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)

# Routers
app.include_router(irrigation.router, prefix="/api/irrigation", tags=["Irrigation"])
app.include_router(disease.router, prefix="/api/disease", tags=["Disease Detection"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])
app.include_router(reference.router, prefix="/api", tags=["Reference Data"])
app.include_router(contact.router, prefix="/api", tags=["Contact"])
app.include_router(newsletter.router, prefix="/api/newsletter", tags=["Newsletter"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI Advisor"])
app.include_router(preferences.router, prefix="/api/preferences", tags=["Preferences"])
app.include_router(reminders.router, prefix="/api/reminders", tags=["Reminders"])
app.include_router(blog.router, prefix="/api/blog", tags=["Blog"])


# Surface Pydantic validation errors in the [api] log so 422s aren't a mystery.
@app.exception_handler(RequestValidationError)
async def _log_validation_error(request: Request, exc: RequestValidationError):
    try:
        errors = jsonable_encoder(exc.errors())
    except Exception:
        # Fall back to a string repr if any value resists encoding (e.g. non-UTF8 bytes).
        errors = [str(e) for e in exc.errors()]
    body = getattr(exc, "body", None)
    if isinstance(body, (bytes, bytearray)):
        body = body.decode("utf-8", errors="replace")
    logger.warning(
        "422 on %s %s — errors=%s body=%r",
        request.method,
        request.url.path,
        errors,
        body,
    )
    return JSONResponse(status_code=422, content={"detail": errors})


@app.get("/")
async def root():
    return {"status": "healthy", "app": settings.app_name, "version": "1.0.0"}


@app.get("/api/health")
async def health_check():
    """Liveness/readiness probe — reports subsystem availability."""
    return {
        "status": "ok",
        "version": "1.0.0",
        "model": model_status(),
        "ai": {"available": ai_available()},
        "email": {"available": email_available()},
    }
