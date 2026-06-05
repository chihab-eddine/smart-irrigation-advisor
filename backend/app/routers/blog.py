"""
Blog endpoints — list posts, read one, rate, comment.

Reads are public (anonymous). Writes require auth via Supabase JWT.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_current_user, get_optional_user
from app.models.database import get_supabase
from app.models.schemas import (
    BlogPostSummary, BlogPostDetail, BlogComment,
    CommentCreate, RatingCreate, TokenPayload,
)

router = APIRouter()


def _localize(row: dict, locale: str, *fields: str) -> dict:
    """Pick `field_fr` or `field_ar` and expose as plain `field` on a copy of row."""
    suffix = "ar" if locale == "ar" else "fr"
    out = dict(row)
    for f in fields:
        out[f] = row.get(f"{f}_{suffix}") or row.get(f"{f}_fr") or ""
    return out


def _aggregate(post_id: str, db) -> dict:
    """Return {avg_rating, rating_count, comment_count} for a post."""
    ratings = (
        db.table("blog_ratings")
        .select("rating", count="exact")
        .eq("post_id", post_id)
        .execute()
    )
    rating_values = [r["rating"] for r in (ratings.data or [])]
    avg = round(sum(rating_values) / len(rating_values), 2) if rating_values else 0
    comments = (
        db.table("blog_comments")
        .select("id", count="exact")
        .eq("post_id", post_id)
        .execute()
    )
    return {
        "avg_rating": avg,
        "rating_count": ratings.count or 0,
        "comment_count": comments.count or 0,
    }


@router.get("/posts")
async def list_posts(
    locale: str = Query("fr"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    category: Optional[str] = None,
):
    """Return paginated post summaries (no auth required)."""
    db = get_supabase()
    query = (
        db.table("blog_posts")
        .select("*", count="exact")
        .order("published_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if category:
        query = query.eq("category", category)
    res = query.execute()

    posts = []
    for row in res.data or []:
        agg = _aggregate(row["id"], db)
        loc = _localize(row, locale, "title", "excerpt")
        posts.append(BlogPostSummary(
            id=row["id"],
            slug=row["slug"],
            title=loc["title"],
            excerpt=loc["excerpt"],
            cover_image_url=row.get("cover_image_url"),
            category=row.get("category", ""),
            reading_time_minutes=row.get("reading_time_minutes") or 5,
            author_name=row.get("author_name") or "",
            published_at=row.get("published_at"),
            **agg,
        ).model_dump())

    return {"data": posts, "total": res.count or 0}


@router.get("/posts/{slug}", response_model=BlogPostDetail)
async def get_post(
    slug: str,
    locale: str = Query("fr"),
    user: Optional[TokenPayload] = Depends(get_optional_user),
):
    """Single post + its comments + the caller's own rating (if logged in)."""
    db = get_supabase()
    res = (
        db.table("blog_posts")
        .select("*")
        .eq("slug", slug)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    row = res.data
    loc = _localize(row, locale, "title", "content")
    agg = _aggregate(row["id"], db)

    # Comments (newest first). We fetch authors in a second query because
    # blog_comments.user_id → auth.users (not public.users), so the postgrest
    # relational join can't find a FK in the public schema.
    com_res = (
        db.table("blog_comments")
        .select("id, user_id, content, created_at")
        .eq("post_id", row["id"])
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    raw_comments = com_res.data or []
    user_ids = list({c["user_id"] for c in raw_comments})

    user_map = {}
    if user_ids:
        u_res = (
            db.table("users")
            .select("id, full_name, email")
            .in_("id", user_ids)
            .execute()
        )
        user_map = {u["id"]: u for u in (u_res.data or [])}

    comments = []
    for c in raw_comments:
        u = user_map.get(c["user_id"], {})
        author = u.get("full_name") or (u.get("email") or "").split("@")[0] or "Utilisateur"
        comments.append(BlogComment(
            id=c["id"],
            user_id=c["user_id"],
            author_name=author,
            content=c["content"],
            created_at=c.get("created_at"),
        ))

    # Caller's own rating
    my_rating = None
    if user:
        r = (
            db.table("blog_ratings")
            .select("rating")
            .eq("post_id", row["id"])
            .eq("user_id", user.sub)
            .maybe_single()
            .execute()
        )
        if r and r.data:
            my_rating = r.data["rating"]

    return BlogPostDetail(
        id=row["id"],
        slug=row["slug"],
        title=loc["title"],
        content=loc["content"],
        cover_image_url=row.get("cover_image_url"),
        category=row.get("category", ""),
        reading_time_minutes=row.get("reading_time_minutes") or 5,
        author_name=row.get("author_name") or "",
        published_at=row.get("published_at"),
        avg_rating=agg["avg_rating"],
        rating_count=agg["rating_count"],
        my_rating=my_rating,
        comments=comments,
    )


@router.post("/posts/{post_id}/comments", response_model=BlogComment)
async def add_comment(
    post_id: str,
    body: CommentCreate,
    user: TokenPayload = Depends(get_current_user),
):
    db = get_supabase()
    # Ensure the post exists
    p = db.table("blog_posts").select("id").eq("id", post_id).maybe_single().execute()
    if not p or not p.data:
        raise HTTPException(status_code=404, detail="Post not found")

    res = db.table("blog_comments").insert({
        "post_id": post_id,
        "user_id": user.sub,
        "content": body.content.strip(),
    }).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to insert comment")
    row = res.data[0]

    # Look up the user's name for immediate display
    u = db.table("users").select("full_name, email").eq("id", user.sub).maybe_single().execute()
    udata = (u and u.data) or {}
    author = udata.get("full_name") or (udata.get("email") or "").split("@")[0] or "Utilisateur"
    return BlogComment(
        id=row["id"],
        user_id=row["user_id"],
        author_name=author,
        content=row["content"],
        created_at=row.get("created_at"),
    )


@router.delete("/posts/{post_id}/comments/{comment_id}")
async def delete_comment(
    post_id: str,
    comment_id: str,
    user: TokenPayload = Depends(get_current_user),
):
    db = get_supabase()
    res = (
        db.table("blog_comments")
        .delete()
        .eq("id", comment_id)
        .eq("post_id", post_id)
        .eq("user_id", user.sub)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"deleted": True}


@router.put("/posts/{post_id}/rating")
async def rate_post(
    post_id: str,
    body: RatingCreate,
    user: TokenPayload = Depends(get_current_user),
):
    """Upsert the caller's rating for a post."""
    db = get_supabase()
    p = db.table("blog_posts").select("id").eq("id", post_id).maybe_single().execute()
    if not p or not p.data:
        raise HTTPException(status_code=404, detail="Post not found")

    res = (
        db.table("blog_ratings")
        .upsert(
            {"post_id": post_id, "user_id": user.sub, "rating": body.rating},
            on_conflict="post_id,user_id",
        )
        .execute()
    )
    agg = _aggregate(post_id, db)
    return {"my_rating": body.rating, **agg}
