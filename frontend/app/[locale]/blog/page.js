"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import Icon from "@/components/Icon";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  SkeletonCard,
  Tag,
  cn,
} from "@/components/ui";
import { createAPIClient } from "@/lib/api";

const CATEGORY = {
  irrigation: { fr: "Irrigation", ar: "الري", icon: "droplet", tone: "primary" },
  disease:    { fr: "Maladies",   ar: "الأمراض", icon: "leaf",   tone: "secondary" },
  planning:   { fr: "Planification", ar: "التخطيط", icon: "calendar", tone: "accent" },
  weather:    { fr: "Météo",      ar: "الطقس", icon: "cloud",  tone: "info" },
};

export default function BlogListPage() {
  const locale = useLocale();
  const ar = locale === "ar";

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const client = createAPIClient();
        const res = await client.listBlogPosts({ locale, limit: 30 });
        if (cancelled) return;
        setPosts(res.data || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [locale]);

  const categories = useMemo(() => {
    const set = new Set(posts.map((p) => p.category).filter(Boolean));
    return Array.from(set);
  }, [posts]);

  const filtered = useMemo(() => {
    if (filter === "all") return posts;
    return posts.filter((p) => p.category === filter);
  }, [posts, filter]);

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="page-container py-6 sm:py-10 max-w-6xl">
      {/* HEADER */}
      <header className="mb-8">
        <Badge variant="secondary" icon="info">{ar ? "المدوّنة" : "Almanach"}</Badge>
        <h1 className="display mt-3 text-3xl sm:text-5xl text-[var(--color-text-strong)]">
          {ar ? "أدلّة وقصص" : "Guides et histoires"}
        </h1>
        <p className="mt-3 text-[15px] text-[var(--color-text-muted)] max-w-2xl leading-relaxed">
          {ar
            ? "نصائح موسمية، تجارب فلاحين، وقصص علمية مبسّطة حول الري الذكي وصحة المحاصيل بالمغرب."
            : "Conseils saisonniers, retours de terrain et explications simples sur l'irrigation intelligente et la santé des cultures au Maroc."}
        </p>
      </header>

      {/* FILTERS */}
      {categories.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Tag selected={filter === "all"} onClick={() => setFilter("all")}>
            {ar ? "الكل" : "Tous"}
          </Tag>
          {categories.map((c) => {
            const meta = CATEGORY[c];
            return (
              <Tag
                key={c}
                selected={filter === c}
                onClick={() => setFilter(c)}
                icon={meta?.icon}
              >
                {meta?.[ar ? "ar" : "fr"] || c}
              </Tag>
            );
          })}
        </div>
      )}

      {/* CONTENT */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <Banner tone="warning" title={ar ? "تعذر التحميل" : "Chargement impossible"}>
          {error}
        </Banner>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="info"
          title={ar ? "لا مقالات" : "Aucun article"}
          description={ar ? "عُد قريباً، نضيف مقالات جديدة كل أسبوع." : "Revenez bientôt, de nouveaux articles chaque semaine."}
        />
      ) : (
        <>
          {/* FEATURED */}
          {featured && (
            <Link href={`/${locale}/blog/${featured.slug}`} className="block group mb-8">
              <Card padding="none" radius="lg" interactive className="overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
                  <div className="lg:col-span-3 relative aspect-[16/9] lg:aspect-auto lg:min-h-[300px] bg-[var(--color-surface-sunken)]">
                    {featured.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={featured.cover_image_url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--gradient-leaf)" }}>
                        <Icon name={CATEGORY[featured.category]?.icon || "leaf"} className="h-16 w-16 text-[var(--color-primary-700)]/30" />
                      </div>
                    )}
                  </div>
                  <div className="lg:col-span-2 p-6 sm:p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={CATEGORY[featured.category]?.tone || "neutral"} icon={CATEGORY[featured.category]?.icon}>
                          {CATEGORY[featured.category]?.[ar ? "ar" : "fr"] || featured.category}
                        </Badge>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {featured.reading_time_minutes} min · {ar ? "للقراءة" : "de lecture"}
                        </span>
                      </div>
                      <h2 className="display mt-4 text-2xl sm:text-3xl text-[var(--color-text-strong)] leading-tight group-hover:text-[var(--color-primary-700)] transition-colors">
                        {featured.title}
                      </h2>
                      <p className="mt-3 text-[15px] text-[var(--color-text-muted)] leading-relaxed line-clamp-3">
                        {featured.excerpt}
                      </p>
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {featured.published_at ? new Date(featured.published_at).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-700)]">
                        {ar ? "اقرأ" : "Lire"}
                        <Icon name="arrowRight" className="h-4 w-4 rtl-flip transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          )}

          {/* GRID */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rest.map((p) => (
                <BlogCard key={p.id} post={p} locale={locale} ar={ar} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function BlogCard({ post, locale, ar }) {
  const meta = CATEGORY[post.category];
  return (
    <Link href={`/${locale}/blog/${post.slug}`} className="block group h-full">
      <Card padding="none" radius="md" interactive className="overflow-hidden h-full flex flex-col">
        <div className="relative aspect-[16/9] bg-[var(--color-surface-sunken)]">
          {post.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.cover_image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: "var(--gradient-leaf)" }}>
              <Icon name={meta?.icon || "leaf"} className="h-10 w-10 text-[var(--color-primary-700)]/30" />
            </div>
          )}
          <div className="absolute top-3 left-3 rtl:left-auto rtl:right-3">
            <Badge variant={meta?.tone || "neutral"} icon={meta?.icon}>
              {meta?.[ar ? "ar" : "fr"] || post.category}
            </Badge>
          </div>
        </div>
        <div className="p-5 flex-1 flex flex-col">
          <h3 className="text-[17px] font-semibold text-[var(--color-text-strong)] leading-snug group-hover:text-[var(--color-primary-700)] transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)] leading-relaxed line-clamp-2">
            {post.excerpt}
          </p>
          <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" className="h-3.5 w-3.5" />
              {post.reading_time_minutes} min
            </span>
            {post.avg_rating > 0 && (
              <span className="inline-flex items-center gap-1">
                <Icon name="checkCircle" className="h-3.5 w-3.5 text-[var(--color-secondary-600)]" />
                <span className="num">{post.avg_rating.toFixed(1)}</span>
                <span className="text-[var(--color-text-subtle)]">({post.rating_count})</span>
              </span>
            )}
            <span className="text-[var(--color-text-subtle)]">
              {post.published_at ? new Date(post.published_at).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short" }) : ""}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
