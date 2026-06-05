"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Skeleton,
  SkeletonText,
  Textarea,
  ToastProvider,
  useToast,
  cn,
} from "@/components/ui";
import { createAPIClient } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const CATEGORY = {
  irrigation: { fr: "Irrigation", ar: "الري", icon: "droplet", tone: "primary" },
  disease:    { fr: "Maladies",   ar: "الأمراض", icon: "leaf",   tone: "secondary" },
  planning:   { fr: "Planification", ar: "التخطيط", icon: "calendar", tone: "accent" },
  weather:    { fr: "Météo",      ar: "الطقس", icon: "cloud",  tone: "info" },
};

export default function BlogPostPage() {
  return (
    <ToastProvider>
      <BlogPostInner />
    </ToastProvider>
  );
}

function BlogPostInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const params = useParams();
  const slug = params?.slug;
  const { user, accessToken: token } = useAuth();
  const toast = useToast();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const client = createAPIClient(token);
        const data = await client.getBlogPost(slug, locale);
        if (!cancelled) setPost(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load post");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, locale, token]);

  const rate = async (value) => {
    if (!user) {
      toast.push({ tone: "warning", title: ar ? "سجّل الدخول للتقييم." : "Connectez-vous pour noter." });
      return;
    }
    setRatingSubmitting(true);
    try {
      const client = createAPIClient(token);
      const res = await client.rateBlogPost(post.id, value);
      setPost({ ...post, my_rating: res.my_rating, avg_rating: res.avg_rating, rating_count: res.rating_count });
      toast.push({ tone: "success", title: ar ? "شكراً لتقييمك" : "Merci pour votre note" });
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setRatingSubmitting(false);
    }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.push({ tone: "warning", title: ar ? "سجّل الدخول للتعليق." : "Connectez-vous pour commenter." });
      return;
    }
    if (!commentDraft.trim()) return;
    setCommentSubmitting(true);
    try {
      const client = createAPIClient(token);
      const c = await client.addBlogComment(post.id, commentDraft.trim());
      setPost({ ...post, comments: [c, ...(post.comments || [])] });
      setCommentDraft("");
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const deleteComment = async (commentId) => {
    if (!user) return;
    if (!window.confirm(ar ? "حذف هذا التعليق؟" : "Supprimer ce commentaire ?")) return;
    try {
      const client = createAPIClient(token);
      await client.deleteBlogComment(post.id, commentId);
      setPost({ ...post, comments: post.comments.filter((c) => c.id !== commentId) });
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    }
  };

  return (
    <div className="page-container py-6 sm:py-10 max-w-3xl">
      <Link
        href={`/${locale}/blog`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] mb-6"
      >
        <Icon name="arrowLeft" className="h-4 w-4 rtl-flip" />
        {ar ? "كل المقالات" : "Tous les articles"}
      </Link>

      {loading ? (
        <article>
          <Skeleton height={280} className="rounded-2xl" />
          <div className="mt-8 space-y-3">
            <Skeleton height={20} width="30%" />
            <Skeleton height={36} width="80%" />
            <SkeletonText lines={6} />
          </div>
        </article>
      ) : error && !post ? (
        <Banner tone="warning" title={ar ? "تعذر التحميل" : "Chargement impossible"}>
          {error}
        </Banner>
      ) : post ? (
        <>
          {/* COVER */}
          {post.cover_image_url ? (
            <div className="rounded-2xl overflow-hidden aspect-[16/9] bg-[var(--color-surface-sunken)] mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.cover_image_url} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="rounded-2xl aspect-[16/9] flex items-center justify-center mb-8" style={{ background: "var(--gradient-leaf)" }}>
              <Icon name={CATEGORY[post.category]?.icon || "leaf"} className="h-16 w-16 text-[var(--color-primary-700)]/30" />
            </div>
          )}

          {/* HEADER */}
          <header className="mb-8">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Badge variant={CATEGORY[post.category]?.tone || "neutral"} icon={CATEGORY[post.category]?.icon}>
                {CATEGORY[post.category]?.[ar ? "ar" : "fr"] || post.category}
              </Badge>
              <span className="text-xs text-[var(--color-text-muted)] inline-flex items-center gap-1">
                <Icon name="clock" className="h-3.5 w-3.5" />
                {post.reading_time_minutes} min
              </span>
              {post.published_at && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  · {new Date(post.published_at).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
            </div>

            <h1 className="display text-3xl sm:text-5xl text-[var(--color-text-strong)] leading-[1.1]">
              {post.title}
            </h1>

            {post.author_name && (
              <div className="mt-5 flex items-center gap-3">
                <Avatar name={post.author_name} size="sm" variant="secondary" />
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-strong)]">
                    {post.author_name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {ar ? "كاتب Saqi" : "Auteur Saqi"}
                  </p>
                </div>
              </div>
            )}
          </header>

          {/* CONTENT */}
          <article className="prose-container !mx-0 !px-0">
            <div className="text-[17px] leading-[1.7] text-[var(--color-text)] space-y-1">
              {post.content?.split("\n").map((line, i) => {
                if (line.startsWith("## "))
                  return <h2 key={i} className="text-2xl font-semibold text-[var(--color-text-strong)] tracking-tight mt-10 mb-3">{line.slice(3)}</h2>;
                if (line.startsWith("### "))
                  return <h3 key={i} className="text-xl font-semibold text-[var(--color-text-strong)] tracking-tight mt-8 mb-2">{line.slice(4)}</h3>;
                if (/^\d+\. /.test(line))
                  return (
                    <p key={i} className="my-2 ps-6 relative">
                      <span className="absolute left-0 rtl:left-auto rtl:right-0 top-0 text-[var(--color-primary-700)] font-semibold">•</span>
                      {line.replace(/^\d+\. /, "")}
                    </p>
                  );
                if (line.startsWith("> "))
                  return (
                    <blockquote
                      key={i}
                      className="my-5 ps-4 border-s-4 border-[var(--color-primary-500)] bg-[var(--color-primary-100)]/40 rounded-e-xl py-3 pe-4 text-[var(--color-primary-900)] italic"
                    >
                      {line.slice(2)}
                    </blockquote>
                  );
                if (!line.trim()) return <div key={i} className="h-3" />;
                const parts = line.split(/(\*\*[^*]+\*\*)/g);
                return (
                  <p key={i} className="my-3">
                    {parts.map((part, j) =>
                      part.startsWith("**") && part.endsWith("**") ? (
                        <strong key={j} className="font-semibold text-[var(--color-text-strong)]">{part.slice(2, -2)}</strong>
                      ) : (
                        <span key={j}>{part}</span>
                      )
                    )}
                  </p>
                );
              })}
            </div>
          </article>

          {/* RATING */}
          <Card padding="md" className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
                  {ar ? "هل أعجبك هذا المقال؟" : "Cet article vous a plu ?"}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                  {post.avg_rating > 0 ? (
                    <>
                      <span className="font-semibold text-[var(--color-text-strong)] num">{post.avg_rating.toFixed(1)}</span>
                      <span> / 5 · {post.rating_count} {ar ? "تقييم" : "avis"}</span>
                    </>
                  ) : (
                    <span>{ar ? "لا توجد تقييمات بعد" : "Pas encore de notes"}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => rate(star)}
                    disabled={ratingSubmitting}
                    aria-label={`${star} / 5`}
                    className="p-1 hover:scale-110 transition-transform disabled:opacity-50 disabled:scale-100"
                  >
                    <Star filled={star <= (post.my_rating || 0)} />
                  </button>
                ))}
              </div>
            </div>
            {!user && (
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                <Link href={`/${locale}/login`} className="font-medium text-[var(--color-primary-700)] hover:underline">
                  {ar ? "سجّل الدخول للتقييم" : "Connectez-vous pour noter"}
                </Link>
              </p>
            )}
          </Card>

          {/* COMMENTS */}
          <section className="mt-10">
            <h2 className="text-lg font-semibold text-[var(--color-text-strong)] mb-4">
              {ar ? "النقاش" : "Discussion"} ({post.comments?.length || 0})
            </h2>

            {user ? (
              <form onSubmit={addComment} className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <Avatar name={user.user_metadata?.full_name || user.email} size="sm" variant="primary" />
                  <Textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder={ar ? "شارك رأيك..." : "Partagez votre avis…"}
                    rows={3}
                    maxLength={2000}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" loading={commentSubmitting} disabled={!commentDraft.trim()} leadingIcon="send">
                    {ar ? "نشر" : "Publier"}
                  </Button>
                </div>
              </form>
            ) : (
              <Banner tone="info" className="mb-6">
                <Link href={`/${locale}/login`} className="font-semibold text-[var(--color-primary-700)] hover:underline">
                  {ar ? "سجّل الدخول" : "Connectez-vous"}
                </Link>
                {ar ? " لكي تشارك في النقاش." : " pour participer à la discussion."}
              </Banner>
            )}

            <ul className="space-y-3">
              {(post.comments || []).length === 0 ? (
                <li>
                  <EmptyState
                    icon="mail"
                    title={ar ? "لا تعليقات بعد" : "Pas encore de commentaires"}
                    description={ar ? "كن أول من يعلّق." : "Soyez le premier à commenter."}
                  />
                </li>
              ) : (
                post.comments.map((c) => (
                  <li key={c.id}>
                    <Card padding="md">
                      <div className="flex items-start gap-3">
                        <Avatar name={c.author_name} size="sm" variant="neutral" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-[var(--color-text-strong)] truncate">
                              {c.author_name}
                            </span>
                            <span className="text-xs text-[var(--color-text-subtle)] shrink-0">
                              {c.created_at
                                ? new Date(c.created_at).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short" })
                                : ""}
                            </span>
                          </div>
                          <p className="mt-1 text-[15px] text-[var(--color-text)] leading-relaxed whitespace-pre-line">
                            {c.content}
                          </p>
                          {user && c.user_id === user.id && (
                            <button
                              type="button"
                              onClick={() => deleteComment(c.id)}
                              className="mt-2 text-xs font-medium text-[var(--color-danger)] hover:underline"
                            >
                              {ar ? "حذف" : "Supprimer"}
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Star({ filled }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill={filled ? "var(--color-secondary-500)" : "none"}
      stroke={filled ? "var(--color-secondary-500)" : "var(--color-border-strong)"}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
