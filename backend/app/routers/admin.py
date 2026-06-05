from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import require_admin
from app.models.schemas import (
    TokenPayload, AdminUserUpdate, AdminContactUpdate,
    AppConfigUpdate, AdminStats, MessageResponse,
    AdminBlogPostCreate, AdminBlogPostUpdate,
)
from app.models.database import get_supabase


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

router = APIRouter()


# ============================================
# Admin Dashboard Stats
# ============================================
@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(admin: TokenPayload = Depends(require_admin)):
    """Get overview statistics for admin dashboard."""
    db = get_supabase()

    users = db.table("users").select("id", count="exact").execute()
    active_users = db.table("users").select("id", count="exact").eq("is_active", True).execute()
    irrigation = db.table("irrigation_predictions").select("id", count="exact").execute()
    disease = db.table("disease_predictions").select("id", count="exact").execute()
    contacts = db.table("contact_messages").select("id", count="exact").execute()
    unread = db.table("contact_messages").select("id", count="exact").eq("status", "new").execute()
    subscribers = db.table("newsletter_subscribers").select("id", count="exact").execute()
    active_subs = db.table("newsletter_subscribers").select("id", count="exact").eq("is_active", True).execute()

    return AdminStats(
        total_users=users.count or 0,
        active_users=active_users.count or 0,
        total_irrigation=irrigation.count or 0,
        total_disease=disease.count or 0,
        total_contacts=contacts.count or 0,
        unread_messages=unread.count or 0,
        total_newsletter=subscribers.count or 0,
        active_subscribers=active_subs.count or 0,
    )


# ============================================
# User Management
# ============================================
@router.get("/users")
async def list_users(
    admin: TokenPayload = Depends(require_admin),
    search: str = "",
    page: int = 1,
    per_page: int = 20,
):
    """List all users with optional search."""
    db = get_supabase()
    offset = (page - 1) * per_page

    query = db.table("users").select("*", count="exact")

    if search:
        query = query.or_(f"full_name.ilike.%{search}%,email.ilike.%{search}%")

    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()

    return {
        "data": result.data,
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/users/{user_id}")
async def get_user(user_id: str, admin: TokenPayload = Depends(require_admin)):
    """Get user details with activity stats."""
    db = get_supabase()

    user = db.table("users").select("*").eq("id", user_id).single().execute()
    if not user.data:
        raise HTTPException(status_code=404, detail="User not found")

    # Count user's predictions
    irrigation_count = (
        db.table("irrigation_predictions")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    disease_count = (
        db.table("disease_predictions")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )

    return {
        **user.data,
        "irrigation_count": irrigation_count.count or 0,
        "disease_count": disease_count.count or 0,
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    update: AdminUserUpdate,
    admin: TokenPayload = Depends(require_admin),
):
    """Update user role or active status."""
    db = get_supabase()

    update_data = {}
    if update.role is not None:
        if update.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Invalid role")
        update_data["role"] = update.role
    if update.is_active is not None:
        update_data["is_active"] = update.is_active

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = db.table("users").update(update_data).eq("id", user_id).execute()
    return {"data": result.data, "message": "User updated"}


@router.delete("/users/{user_id}")
async def deactivate_user(user_id: str, admin: TokenPayload = Depends(require_admin)):
    """Deactivate a user (soft delete)."""
    db = get_supabase()
    db.table("users").update({"is_active": False}).eq("id", user_id).execute()
    return MessageResponse(message="User deactivated", success=True)


# ============================================
# Contact Messages
# ============================================
@router.get("/contacts")
async def list_contacts(
    admin: TokenPayload = Depends(require_admin),
    status: str = "",
    page: int = 1,
    per_page: int = 20,
):
    """List contact messages with optional status filter."""
    db = get_supabase()
    offset = (page - 1) * per_page

    query = db.table("contact_messages").select("*", count="exact")

    if status:
        query = query.eq("status", status)

    result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()

    return {
        "data": result.data,
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/contacts/{contact_id}")
async def get_contact(contact_id: str, admin: TokenPayload = Depends(require_admin)):
    """Get a single contact message."""
    db = get_supabase()
    result = db.table("contact_messages").select("*").eq("id", contact_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Message not found")

    # Mark as read if new
    if result.data.get("status") == "new":
        db.table("contact_messages").update({
            "status": "read",
            "read_at": _utcnow_iso(),
        }).eq("id", contact_id).execute()

    return result.data


@router.patch("/contacts/{contact_id}")
async def update_contact(
    contact_id: str,
    update: AdminContactUpdate,
    admin: TokenPayload = Depends(require_admin),
):
    """Update contact message status or admin notes."""
    db = get_supabase()

    update_data = {}
    if update.status is not None:
        update_data["status"] = update.status
    if update.admin_notes is not None:
        update_data["admin_notes"] = update.admin_notes

    result = db.table("contact_messages").update(update_data).eq("id", contact_id).execute()
    return {"data": result.data, "message": "Contact updated"}


@router.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: str, admin: TokenPayload = Depends(require_admin)):
    """Delete a contact message."""
    db = get_supabase()
    db.table("contact_messages").delete().eq("id", contact_id).execute()
    return MessageResponse(message="Contact deleted", success=True)


# ============================================
# Newsletter Management
# ============================================
@router.get("/newsletter")
async def list_subscribers(
    admin: TokenPayload = Depends(require_admin),
    active_only: bool = False,
    page: int = 1,
    per_page: int = 20,
):
    """List newsletter subscribers."""
    db = get_supabase()
    offset = (page - 1) * per_page

    query = db.table("newsletter_subscribers").select("*", count="exact")

    if active_only:
        query = query.eq("is_active", True)

    result = query.order("subscribed_at", desc=True).range(offset, offset + per_page - 1).execute()

    return {
        "data": result.data,
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/newsletter/stats")
async def newsletter_stats(admin: TokenPayload = Depends(require_admin)):
    """Get newsletter statistics."""
    db = get_supabase()

    total = db.table("newsletter_subscribers").select("id", count="exact").execute()
    active = db.table("newsletter_subscribers").select("id", count="exact").eq("is_active", True).execute()
    fr_count = db.table("newsletter_subscribers").select("id", count="exact").eq("locale", "fr").eq("is_active", True).execute()
    ar_count = db.table("newsletter_subscribers").select("id", count="exact").eq("locale", "ar").eq("is_active", True).execute()

    return {
        "total": total.count or 0,
        "active": active.count or 0,
        "inactive": (total.count or 0) - (active.count or 0),
        "by_locale": {
            "fr": fr_count.count or 0,
            "ar": ar_count.count or 0,
        },
    }


@router.delete("/newsletter/{subscriber_id}")
async def remove_subscriber(subscriber_id: str, admin: TokenPayload = Depends(require_admin)):
    """Remove a newsletter subscriber."""
    db = get_supabase()
    db.table("newsletter_subscribers").delete().eq("id", subscriber_id).execute()
    return MessageResponse(message="Subscriber removed", success=True)


# ============================================
# App Config
# ============================================
@router.get("/config")
async def get_config(admin: TokenPayload = Depends(require_admin)):
    """Get all app config key-value pairs."""
    db = get_supabase()
    result = db.table("app_config").select("*").order("category").execute()
    return result.data


@router.put("/config/{key}")
async def update_config(
    key: str,
    update: AppConfigUpdate,
    admin: TokenPayload = Depends(require_admin),
):
    """Update an app config value."""
    db = get_supabase()
    result = db.table("app_config").update({
        "value": update.value,
        "updated_at": _utcnow_iso(),
    }).eq("key", key).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Config key not found")

    return {"data": result.data[0], "message": "Config updated"}


# ============================================
# Blog — admin CRUD
# ============================================
@router.get("/blog/posts")
async def list_blog_posts(
    admin: TokenPayload = Depends(require_admin),
    search: str = "",
    category: str = "",
    status: str = "",  # "" | "published" | "draft"
    page: int = 1,
    per_page: int = 20,
):
    """List all blog posts (including drafts), with counts for ratings/comments."""
    db = get_supabase()
    offset = (page - 1) * per_page

    query = db.table("blog_posts").select("*", count="exact")

    if search:
        query = query.or_(
            f"title_fr.ilike.%{search}%,title_ar.ilike.%{search}%,slug.ilike.%{search}%"
        )
    if category:
        query = query.eq("category", category)
    if status == "published":
        query = query.not_.is_("published_at", "null")
    elif status == "draft":
        query = query.is_("published_at", "null")

    result = (
        query.order("created_at", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )

    rows = result.data or []
    post_ids = [r["id"] for r in rows]

    # Aggregate comment + rating counts in two batched queries (no N+1).
    comment_counts: dict[str, int] = {}
    rating_stats: dict[str, dict] = {}
    if post_ids:
        try:
            c_res = (
                db.table("blog_comments")
                .select("post_id")
                .in_("post_id", post_ids)
                .execute()
            )
            for r in c_res.data or []:
                comment_counts[r["post_id"]] = comment_counts.get(r["post_id"], 0) + 1
        except Exception:
            pass

        try:
            r_res = (
                db.table("blog_ratings")
                .select("post_id, rating")
                .in_("post_id", post_ids)
                .execute()
            )
            buckets: dict[str, list[int]] = {}
            for r in r_res.data or []:
                buckets.setdefault(r["post_id"], []).append(int(r["rating"]))
            for pid, ratings in buckets.items():
                rating_stats[pid] = {
                    "count": len(ratings),
                    "avg": round(sum(ratings) / len(ratings), 2) if ratings else 0,
                }
        except Exception:
            pass

    enriched = [
        {
            **row,
            "comment_count": comment_counts.get(row["id"], 0),
            "rating_count": rating_stats.get(row["id"], {}).get("count", 0),
            "avg_rating": rating_stats.get(row["id"], {}).get("avg", 0),
        }
        for row in rows
    ]

    return {
        "data": enriched,
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/blog/posts/{post_id}")
async def get_blog_post(post_id: str, admin: TokenPayload = Depends(require_admin)):
    """Get a single blog post by id (admin view — includes draft state)."""
    db = get_supabase()
    result = (
        db.table("blog_posts")
        .select("*")
        .eq("id", post_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return result.data


@router.post("/blog/posts", response_model=dict)
async def create_blog_post(
    payload: AdminBlogPostCreate,
    admin: TokenPayload = Depends(require_admin),
):
    """Create a new blog post. If `published_at` is null, the post is a draft."""
    db = get_supabase()

    # Reject duplicate slugs early with a clear error
    existing = (
        db.table("blog_posts")
        .select("id")
        .eq("slug", payload.slug)
        .maybe_single()
        .execute()
    )
    if existing and existing.data:
        raise HTTPException(status_code=409, detail="A post with this slug already exists")

    insert_data = payload.model_dump(exclude_none=False)
    # Default published_at to now() at the DB layer if omitted
    if insert_data.get("published_at") is None:
        insert_data.pop("published_at", None)

    result = db.table("blog_posts").insert(insert_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create post")
    return {"data": result.data[0], "message": "Post created"}


@router.patch("/blog/posts/{post_id}", response_model=dict)
async def update_blog_post(
    post_id: str,
    payload: AdminBlogPostUpdate,
    admin: TokenPayload = Depends(require_admin),
):
    """Update an existing blog post. Pass only the fields you want to change."""
    db = get_supabase()
    update_data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # If slug is changing, ensure it doesn't clash with another post
    if "slug" in update_data:
        clash = (
            db.table("blog_posts")
            .select("id")
            .eq("slug", update_data["slug"])
            .neq("id", post_id)
            .maybe_single()
            .execute()
        )
        if clash and clash.data:
            raise HTTPException(status_code=409, detail="Another post already uses this slug")

    result = db.table("blog_posts").update(update_data).eq("id", post_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Blog post not found")
    return {"data": result.data[0], "message": "Post updated"}


@router.delete("/blog/posts/{post_id}")
async def delete_blog_post(post_id: str, admin: TokenPayload = Depends(require_admin)):
    """Delete a blog post (and any cascade-linked comments / ratings)."""
    db = get_supabase()
    # Manual cleanup in case FK doesn't cascade
    try:
        db.table("blog_comments").delete().eq("post_id", post_id).execute()
    except Exception:
        pass
    try:
        db.table("blog_ratings").delete().eq("post_id", post_id).execute()
    except Exception:
        pass
    db.table("blog_posts").delete().eq("id", post_id).execute()
    return MessageResponse(message="Blog post deleted", success=True)
