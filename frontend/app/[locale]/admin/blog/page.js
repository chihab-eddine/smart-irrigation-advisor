"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import { createAPIClient } from "@/lib/api";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
  Tabs,
  ToastProvider,
  useToast,
  cn,
} from "@/components/ui";

const PER_PAGE = 20;

const CATEGORY_META = {
  irrigation: { fr: "Irrigation",    ar: "الري",       icon: "droplet",  tone: "primary" },
  disease:    { fr: "Maladies",       ar: "الأمراض",    icon: "leaf",     tone: "secondary" },
  planning:   { fr: "Planification",  ar: "التخطيط",    icon: "calendar", tone: "accent" },
  weather:    { fr: "Météo",          ar: "الطقس",      icon: "cloud",    tone: "info" },
};

export default function AdminBlogListPage() {
  return (
    <ToastProvider>
      <BlogListInner />
    </ToastProvider>
  );
}

function BlogListInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const { accessToken } = useAuth();
  const toast = useToast();

  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("all"); // all | published | draft
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(null);

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const client = createAPIClient(accessToken);
      const res = await client.getAdminBlogPosts({
        page,
        search,
        category,
        status: status === "all" ? "" : status,
      });
      setPosts(res?.data || []);
      setTotal(res?.total || 0);
    } catch (err) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, page, search, category, status]);

  const onSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const deletePost = async (post) => {
    if (!accessToken) return;
    if (!window.confirm(
      ar
        ? `حذف المقال "${post.title_fr || post.slug}" نهائياً؟ هذا الإجراء لا يُتراجع عنه.`
        : `Supprimer définitivement "${post.title_fr || post.slug}" ? Cette action est irréversible.`
    )) return;
    setDeleting(post.id);
    try {
      const client = createAPIClient(accessToken);
      await client.deleteAdminBlogPost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setTotal((t) => Math.max(0, t - 1));
      toast.push({ tone: "success", title: ar ? "تم الحذف" : "Article supprimé" });
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setDeleting(null);
    }
  };

  const togglePublish = async (post) => {
    if (!accessToken) return;
    const willPublish = !post.published_at;
    try {
      const client = createAPIClient(accessToken);
      const res = await client.updateAdminBlogPost(post.id, {
        published_at: willPublish ? new Date().toISOString() : null,
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, ...(res?.data || {}) } : p))
      );
      toast.push({
        tone: "success",
        title: willPublish
          ? (ar ? "تم النشر" : "Article publié")
          : (ar ? "تم تحويله إلى مسودة" : "Article repassé en brouillon"),
      });
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    }
  };

  const categories = useMemo(() => Object.keys(CATEGORY_META), []);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Badge variant="secondary" icon="edit">{ar ? "المدوّنة" : "Blog"}</Badge>
          <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
            {ar ? "المقالات" : "Articles"}
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--color-text-muted)]">
            {ar
              ? "أنشئ، حرر وانشر مقالات Saqi بالفرنسية والعربية."
              : "Créez, modifiez et publiez les articles Saqi en français et en arabe."}
          </p>
        </div>
        <Button
          href={`/${locale}/admin/blog/new`}
          leadingIcon="check"
          size="md"
        >
          {ar ? "مقال جديد" : "Nouvel article"}
        </Button>
      </header>

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs
          items={[
            { value: "all",       label: `${ar ? "الكل" : "Tous"} (${total})` },
            { value: "published", label: ar ? "منشور" : "Publiés" },
            { value: "draft",     label: ar ? "مسودة" : "Brouillons" },
          ]}
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
        />
        <form onSubmit={onSearch} className="flex gap-2">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={ar ? "بحث بالعنوان أو slug..." : "Titre ou slug…"}
            leadingIcon="search"
            className="sm:w-72"
          />
          <Button type="submit" size="md" leadingIcon="search">
            {ar ? "بحث" : "Chercher"}
          </Button>
        </form>
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => { setCategory(""); setPage(1); }}
          className={cn(
            "inline-flex items-center h-8 px-3 rounded-full text-xs font-medium border transition-colors",
            category === ""
              ? "bg-[var(--color-text-strong)] text-[var(--color-text-inverse)] border-[var(--color-text-strong)]"
              : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
          )}
        >
          {ar ? "كل الفئات" : "Toutes catégories"}
        </button>
        {categories.map((c) => {
          const meta = CATEGORY_META[c];
          const active = category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => { setCategory(active ? "" : c); setPage(1); }}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
                  : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
              )}
            >
              <Icon name={meta.icon} className="h-3 w-3" />
              {ar ? meta.ar : meta.fr}
            </button>
          );
        })}
      </div>

      {error && <Banner tone="danger" title={ar ? "خطأ" : "Erreur"}>{error}</Banner>}

      {/* Table */}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-[var(--color-surface-sunken)]">
              <tr>
                <Th>{ar ? "المقال" : "Article"}</Th>
                <Th>{ar ? "الفئة" : "Catégorie"}</Th>
                <Th>{ar ? "الحالة" : "Statut"}</Th>
                <Th>{ar ? "تفاعل" : "Engagement"}</Th>
                <Th>{ar ? "نُشر في" : "Publié le"}</Th>
                <Th className="text-end">{ar ? "إجراءات" : "Actions"}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-5 py-3"><Skeleton height={48} /></td>
                  </tr>
                ))
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12">
                    <EmptyState
                      icon="edit"
                      title={ar ? "لا مقالات" : "Aucun article"}
                      description={
                        search || category || status !== "all"
                          ? (ar ? "غيّر التصفيات أو ابحث بكلمة أخرى." : "Modifiez les filtres ou la recherche.")
                          : (ar ? "ابدأ بإنشاء مقالك الأول." : "Créez votre premier article.")
                      }
                      action={
                        <Button href={`/${locale}/admin/blog/new`} leadingIcon="check">
                          {ar ? "مقال جديد" : "Nouvel article"}
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                posts.map((p) => (
                  <BlogRow
                    key={p.id}
                    post={p}
                    locale={locale}
                    ar={ar}
                    onTogglePublish={() => togglePublish(p)}
                    onDelete={() => deletePost(p)}
                    deleting={deleting === p.id}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {total > PER_PAGE && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[var(--color-text-muted)]">
            {ar ? "صفحة" : "Page"}{" "}
            <span className="num font-semibold text-[var(--color-text-strong)]">{page}</span>
            {" / "}
            <span className="num">{pageCount}</span>
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              variant="secondary"
              size="sm"
              leadingIcon="chevronLeft"
            >
              {ar ? "السابق" : "Précédent"}
            </Button>
            <Button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pageCount || loading}
              variant="secondary"
              size="sm"
              trailingIcon="chevronRight"
            >
              {ar ? "التالي" : "Suivant"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className }) {
  return (
    <th className={cn(
      "px-5 py-3.5 text-start text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] whitespace-nowrap",
      className
    )}>
      {children}
    </th>
  );
}

function BlogRow({ post, locale, ar, onTogglePublish, onDelete, deleting }) {
  const meta = CATEGORY_META[post.category] || { fr: post.category, ar: post.category, icon: "info", tone: "neutral" };
  const published = Boolean(post.published_at);
  const title = ar ? (post.title_ar || post.title_fr) : (post.title_fr || post.title_ar);

  return (
    <tr className="hover:bg-[var(--color-surface-muted)] transition-colors">
      <td className="px-5 py-3.5">
        <Link href={`/${locale}/admin/blog/${post.id}`} className="flex items-center gap-3 group max-w-md">
          <div className="h-12 w-16 rounded-lg overflow-hidden bg-[var(--color-surface-sunken)] shrink-0 relative">
            {post.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.cover_image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Icon name={meta.icon} className="h-5 w-5 text-[var(--color-text-subtle)]" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text-strong)] group-hover:text-[var(--color-primary-700)] line-clamp-1">
              {title || <span className="italic text-[var(--color-text-subtle)]">{ar ? "بلا عنوان" : "Sans titre"}</span>}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] font-mono truncate">/{post.slug}</p>
          </div>
        </Link>
      </td>
      <td className="px-5 py-3.5">
        <Badge variant={meta.tone} icon={meta.icon} size="sm">{ar ? meta.ar : meta.fr}</Badge>
      </td>
      <td className="px-5 py-3.5">
        {published ? (
          <Badge variant="success" icon="checkCircle">{ar ? "منشور" : "Publié"}</Badge>
        ) : (
          <Badge variant="warning" icon="edit">{ar ? "مسودة" : "Brouillon"}</Badge>
        )}
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1" title={ar ? "تقييم" : "Note"}>
            <Icon name="checkCircle" className="h-3.5 w-3.5 text-[var(--color-secondary-600)]" />
            <span className="num">{(post.avg_rating || 0).toFixed(1)}</span>
            <span className="text-[var(--color-text-subtle)]">({post.rating_count || 0})</span>
          </span>
          <span className="inline-flex items-center gap-1" title={ar ? "تعليقات" : "Commentaires"}>
            <Icon name="mail" className="h-3.5 w-3.5" />
            <span className="num">{post.comment_count || 0}</span>
          </span>
        </div>
      </td>
      <td className="px-5 py-3.5 text-sm text-[var(--color-text-muted)] whitespace-nowrap">
        {post.published_at
          ? new Date(post.published_at).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short", year: "numeric" })
          : "—"}
      </td>
      <td className="px-5 py-3.5 text-end">
        <div className="inline-flex items-center gap-1.5">
          {published && (
            <Button
              href={`/${locale}/blog/${post.slug}`}
              variant="ghost"
              size="sm"
              leadingIcon="externalLink"
              as="a"
              target="_blank"
            >
              {ar ? "عرض" : "Voir"}
            </Button>
          )}
          <Button onClick={onTogglePublish} variant="ghost" size="sm" leadingIcon={published ? "close" : "send"}>
            {published ? (ar ? "إلغاء النشر" : "Dépublier") : (ar ? "نشر" : "Publier")}
          </Button>
          <Button href={`/${locale}/admin/blog/${post.id}`} variant="secondary" size="sm" leadingIcon="edit">
            {ar ? "تعديل" : "Éditer"}
          </Button>
          <Button
            onClick={onDelete}
            loading={deleting}
            variant="ghost"
            size="sm"
            leadingIcon="trash"
            className="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
            aria-label={ar ? "حذف" : "Supprimer"}
          />
        </div>
      </td>
    </tr>
  );
}
