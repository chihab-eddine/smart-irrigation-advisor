from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date, datetime


# ============================================
# Auth
# ============================================
class TokenPayload(BaseModel):
    sub: str
    email: Optional[str] = None
    role: Optional[str] = "user"


# ============================================
# Irrigation
# ============================================
class IrrigationRequest(BaseModel):
    crop_id: int
    soil_type_id: int
    region_id: int
    planting_date: Optional[date] = None
    locale: str = "fr"
    # Field geometry + chosen irrigation system
    land_size_m2: Optional[float] = None       # surface area of the parcel
    irrigation_method: Optional[str] = None    # "drip" | "sprinkler" | "surface"
    # Drip-only parameters (used when irrigation_method == "drip")
    pump_flow_rate_lph: Optional[float] = None # pump throughput in L/h
    drip_flow_rate_lph: Optional[float] = None # per-emitter flow in L/h (typ. 2–8)
    num_emitters: Optional[int] = None         # total emitters in the field


class IrrigationResponse(BaseModel):
    id: Optional[str] = None
    crop_name: str = ""
    region_name: str = ""
    soil_type_name: str = ""
    growth_stage: str = ""
    eto_value: float = 0
    etc_value: float = 0
    recommended_water_mm: float = 0
    recommendation: str = ""
    alert_level: str = "normal"
    weather_summary: dict = {}
    forecast: list = []
    harvest_estimate: dict = {}
    # System-aware extensions
    land_size_m2: float = 0
    irrigation_method: str = ""
    irrigation_efficiency: float = 0     # 0..1
    gross_water_mm: float = 0            # what you must APPLY (vs net crop need)
    total_water_liters: float = 0        # gross_mm × land_size_m²
    water_savings: dict = {}             # liters per method + savings vs worst
    drip_info: dict = {}                 # duration_hours, liters_per_emitter, pump_ok
    created_at: Optional[str] = None


# ============================================
# Disease Detection
# ============================================
class DiseaseResponse(BaseModel):
    id: Optional[str] = None
    disease_key: str = ""
    disease_name: str = ""
    confidence_score: float = 0
    treatment: str = ""
    crop_type: str = ""
    image_url: str = ""
    top_predictions: list[dict] = []
    uncertain: bool = False
    entropy: float = 0
    created_at: Optional[str] = None


# ============================================
# Contact
# ============================================
class ContactRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    subject: str = Field("", max_length=200)
    message: str = Field(..., min_length=2, max_length=2000)


class ContactResponse(BaseModel):
    id: str
    full_name: str
    email: str
    subject: str
    message: str
    status: str = "new"
    admin_notes: str = ""
    created_at: str
    read_at: Optional[str] = None


# ============================================
# Newsletter
# ============================================
class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr
    locale: str = "fr"


class NewsletterUnsubscribeRequest(BaseModel):
    email: EmailStr


# ============================================
# Admin
# ============================================
class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


class AdminContactUpdate(BaseModel):
    status: Optional[str] = None
    admin_notes: Optional[str] = None


class AppConfigUpdate(BaseModel):
    value: str


class AdminStats(BaseModel):
    total_users: int = 0
    active_users: int = 0
    total_irrigation: int = 0
    total_disease: int = 0
    total_contacts: int = 0
    unread_messages: int = 0
    total_newsletter: int = 0
    active_subscribers: int = 0


# ============================================
# Reference Data
# ============================================
class CropResponse(BaseModel):
    id: int
    name_fr: str
    name_ar: str
    kc_initial: float
    kc_mid: float
    kc_late: float
    growth_duration_days: int
    category: str


class SoilTypeResponse(BaseModel):
    id: int
    name_fr: str
    name_ar: str
    field_capacity: float
    wilting_point: float
    infiltration_rate: float


class RegionResponse(BaseModel):
    id: int
    name_fr: str
    name_ar: str
    latitude: float
    longitude: float
    climate_zone: str


# ============================================
# Common
# ============================================
class PaginatedResponse(BaseModel):
    data: list
    total: int
    page: int = 1
    per_page: int = 20


class MessageResponse(BaseModel):
    message: str
    success: bool = True


# ============================================
# AI Advisory
# ============================================
class IrrigationTipsRequest(BaseModel):
    crop_name: str = ""
    region_name: str = ""
    soil_type_name: str = ""
    growth_stage: str = ""
    recommended_water_mm: float = 0
    eto_value: float = 0
    etc_value: float = 0
    alert_level: str = "normal"
    weather_summary: dict = {}
    locale: str = "fr"


class DiseaseTipsRequest(BaseModel):
    disease_key: str = ""
    disease_name: str = ""
    confidence_score: float = 0
    crop_type: str = ""
    treatment: str = ""
    locale: str = "fr"


class AITextResponse(BaseModel):
    text: str
    model: str = ""
    available: bool = True


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    locale: str = "fr"


# ============================================
# Blog
# ============================================
class BlogPostSummary(BaseModel):
    id: str
    slug: str
    title: str = ""
    excerpt: str = ""
    cover_image_url: Optional[str] = None
    category: str = ""
    reading_time_minutes: int = 5
    author_name: str = ""
    published_at: Optional[str] = None
    avg_rating: float = 0
    rating_count: int = 0
    comment_count: int = 0


class BlogComment(BaseModel):
    id: str
    user_id: str
    author_name: str = ""
    content: str
    created_at: Optional[str] = None


class BlogPostDetail(BaseModel):
    id: str
    slug: str
    title: str = ""
    content: str = ""
    cover_image_url: Optional[str] = None
    category: str = ""
    reading_time_minutes: int = 5
    author_name: str = ""
    published_at: Optional[str] = None
    avg_rating: float = 0
    rating_count: int = 0
    my_rating: Optional[int] = None
    comments: list[BlogComment] = []


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class RatingCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)


# ============================================
# Blog — admin CRUD
# ============================================
class AdminBlogPost(BaseModel):
    id: str
    slug: str
    title_fr: str = ""
    title_ar: str = ""
    excerpt_fr: Optional[str] = None
    excerpt_ar: Optional[str] = None
    content_fr: str = ""
    content_ar: str = ""
    cover_image_url: Optional[str] = None
    category: str = "irrigation"
    reading_time_minutes: int = 5
    author_name: str = "Smart Irrigation Team"
    published_at: Optional[str] = None
    created_at: Optional[str] = None
    comment_count: int = 0
    rating_count: int = 0
    avg_rating: float = 0


class AdminBlogPostCreate(BaseModel):
    slug: str = Field(..., min_length=1, max_length=160)
    title_fr: str = Field(..., min_length=1, max_length=300)
    title_ar: str = Field(..., min_length=1, max_length=300)
    excerpt_fr: Optional[str] = ""
    excerpt_ar: Optional[str] = ""
    content_fr: str = Field(..., min_length=1)
    content_ar: str = Field(..., min_length=1)
    cover_image_url: Optional[str] = None
    category: str = "irrigation"
    reading_time_minutes: int = Field(5, ge=1, le=120)
    author_name: str = "Smart Irrigation Team"
    published_at: Optional[str] = None  # ISO date; null = draft


class AdminBlogPostUpdate(BaseModel):
    slug: Optional[str] = None
    title_fr: Optional[str] = None
    title_ar: Optional[str] = None
    excerpt_fr: Optional[str] = None
    excerpt_ar: Optional[str] = None
    content_fr: Optional[str] = None
    content_ar: Optional[str] = None
    cover_image_url: Optional[str] = None
    category: Optional[str] = None
    reading_time_minutes: Optional[int] = Field(None, ge=1, le=120)
    author_name: Optional[str] = None
    published_at: Optional[str] = None  # set to null to unpublish (draft)


# ============================================
# Notification preferences
# ============================================
class NotificationPreferences(BaseModel):
    notification_enabled: bool = False
    notification_hour: int = 7      # 0-23, user's local hour
    notification_minute: int = 0    # 0-59
    notification_region_id: Optional[int] = None
    notification_crop_id: Optional[int] = None
    notification_planting_date: Optional[date] = None
