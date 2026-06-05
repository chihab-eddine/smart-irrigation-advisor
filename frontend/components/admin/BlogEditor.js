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
  Input,
  Select,
  Skeleton,
  Switch,
  Tabs,
  Textarea,
  useToast,
  cn,
} from "@/components/ui";

const CATEGORIES = [
  { value: "irrigation", fr: "Irrigation",    ar: "الري" },
  { value: "disease",    fr: "Maladies",       ar: "الأمراض" },
  { value: "planning",   fr: "Planification",  ar: "التخطيط" },
  { value: "weather",    fr: "Météo",          ar: "الطقس" },
];

const EMPTY = {
  slug: "",
  title_fr: "",
  title_ar: "",
  excerpt_fr: "",
  excerpt_ar: "",
  content_fr: "",
  content_ar: "",
  cover_image_url: "",
  category: "irrigation",
  reading_time_minutes: 5,
  author_name: "Smart Irrigation Team",
  published_at: null,
};

function slugify(text = "") {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export default function BlogEditor({ postId = null }) {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const { accessToken } = useAuth();
  const toast = useToast();
  const isEdit = Boolean(postId);

  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewLang, setPreviewLang] = useState(ar ? "ar" : "fr");
  const [autoSlug, setAutoSlug] = useState(!isEdit);

  // Load existing post
  useEffect(() => {
    if (!isEdit || !accessToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const client = createAPIClient(accessToken);
        const data = await client.getAdminBlogPost(postId);
        if (cancelled) return;
        const filled = { ...EMPTY, ...data };
        setForm(filled);
        setOriginal(filled);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, postId, accessToken]);

  const setField = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Auto-derive slug from FR title when in create-mode and the user hasn't
      // manually touched the slug field.
      if (key === "title_fr" && autoSlug && !isEdit) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const dirty = useMemo(() => {
    return JSON.stringify(form) !== JSON.stringify(original);
  }, [form, original]);

  const validate = () => {
    if (!form.slug?.trim()) return ar ? "Slug مطلوب." : "Le slug est requis.";
    if (!/^[a-z0-9-]+$/.test(form.slug)) return ar
      ? "Slug يحتوي فقط على أحرف صغيرة وأرقام وشرطات."
      : "Le slug ne doit contenir que des lettres minuscules, chiffres et tirets.";
    if (!form.title_fr?.trim()) return ar ? "العنوان بالفرنسية مطلوب." : "Le titre français est requis.";
    if (!form.title_ar?.trim()) return ar ? "العنوان بالعربية مطلوب." : "Le titre arabe est requis.";
    if (!form.content_fr?.trim()) return ar ? "المحتوى بالفرنسية مطلوب." : "Le contenu français est requis.";
    if (!form.content_ar?.trim()) return ar ? "المحتوى بالعربية مطلوب." : "Le contenu arabe est requis.";
    return null;
  };

  const save = async (publishNow = null) => {
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    if (!accessToken) return;
    setSaving(true);
    try {
      const client = createAPIClient(accessToken);

      // Build the payload — translate "" cover url to null, normalise types.
      const payload = {
        ...form,
        cover_image_url: form.cover_image_url?.trim() || null,
        reading_time_minutes: Number(form.reading_time_minutes) || 5,
      };

      // Explicit publish-state override (clicking "Publish" or "Move to draft")
      if (publishNow === true) {
        payload.published_at = new Date().toISOString();
      } else if (publishNow === false) {
        payload.published_at = null;
      }

      if (isEdit) {
        const res = await client.updateAdminBlogPost(postId, payload);
        const updated = { ...EMPTY, ...(res?.data || payload) };
        setForm(updated);
        setOriginal(updated);
        toast.push({
          tone: "success",
          title: ar ? "تم الحفظ" : "Article enregistré",
        });
      } else {
        const res = await client.createAdminBlogPost(payload);
        const created = res?.data;
        toast.push({
          tone: "success",
          title: ar ? "تم الإنشاء" : "Article créé",
        });
        if (created?.id) {
          router.replace(`/${locale}/admin/blog/${created.id}`);
        } else {
          router.replace(`/${locale}/admin/blog`);
        }
      }
    } catch (err) {
      const msg = err?.message || (ar ? "تعذر الحفظ." : "Échec de l'enregistrement.");
      setError(msg);
      toast.push({ tone: "danger", title: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <Skeleton height={48} width="40%" />
        <Skeleton height={400} />
      </div>
    );
  }

  const isPublished = Boolean(form.published_at);

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-32">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href={`/${locale}/admin/blog`}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] mb-3"
          >
            <Icon name="arrowLeft" className="h-4 w-4 rtl-flip" />
            {ar ? "كل المقالات" : "Tous les articles"}
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" icon="edit">{ar ? "المدوّنة" : "Blog"}</Badge>
            {isEdit && (isPublished
              ? <Badge variant="success" icon="checkCircle">{ar ? "منشور" : "Publié"}</Badge>
              : <Badge variant="warning" icon="edit">{ar ? "مسودة" : "Brouillon"}</Badge>
            )}
            {dirty && <Badge variant="warning" size="sm">{ar ? "تعديلات غير محفوظة" : "Non enregistré"}</Badge>}
          </div>
          <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
            {isEdit
              ? (form.title_fr || form.title_ar || (ar ? "تعديل" : "Modifier"))
              : (ar ? "مقال جديد" : "Nouvel article")}
          </h1>
        </div>
        {isEdit && isPublished && form.slug && (
          <a
            href={`/${locale}/blog/${form.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary-700)] hover:underline"
          >
            <Icon name="externalLink" className="h-4 w-4" />
            {ar ? "عرض على الموقع" : "Voir sur le site"}
          </a>
        )}
      </header>

      {error && <Banner tone="danger" title={ar ? "خطأ" : "Erreur"}>{error}</Banner>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-5">
          {/* Slug */}
          <Card padding="md">
            <Input
              label={ar ? "Slug (في الرابط)" : "Slug (dans l'URL)"}
              value={form.slug}
              onChange={(e) => { setAutoSlug(false); setField("slug", slugify(e.target.value)); }}
              placeholder="mon-article"
              hint={`/${locale}/blog/${form.slug || "mon-article"}`}
              className="font-mono"
              required
            />
          </Card>

          {/* Bilingual content tabs */}
          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
                {ar ? "محتوى المقال" : "Contenu de l'article"}
              </h3>
              <Tabs
                items={[
                  { value: "fr", label: "Français" },
                  { value: "ar", label: "العربية" },
                ]}
                value={previewLang}
                onChange={setPreviewLang}
                size="sm"
              />
            </div>

            {previewLang === "fr" ? (
              <div className="space-y-4">
                <Input
                  label="Titre (FR)"
                  value={form.title_fr}
                  onChange={(e) => setField("title_fr", e.target.value)}
                  placeholder="Comment irriguer un olivier en été"
                  required
                />
                <Textarea
                  label="Extrait / résumé (FR)"
                  value={form.excerpt_fr || ""}
                  onChange={(e) => setField("excerpt_fr", e.target.value)}
                  rows={2}
                  hint="2–3 lignes qui résument l'article (affichées sur la liste blog)."
                />
                <Textarea
                  label="Contenu (FR)"
                  value={form.content_fr}
                  onChange={(e) => setField("content_fr", e.target.value)}
                  rows={18}
                  hint="Markdown léger : ## titres, ### sous-titres, **gras**, > citations, listes numérotées."
                  required
                />
              </div>
            ) : (
              <div className="space-y-4" dir="rtl">
                <Input
                  label="العنوان (بالعربية)"
                  value={form.title_ar}
                  onChange={(e) => setField("title_ar", e.target.value)}
                  placeholder="كيف تسقي الزيتون في الصيف"
                  required
                />
                <Textarea
                  label="الملخّص (بالعربية)"
                  value={form.excerpt_ar || ""}
                  onChange={(e) => setField("excerpt_ar", e.target.value)}
                  rows={2}
                  hint="سطران أو ثلاثة يلخّصون المقال."
                />
                <Textarea
                  label="المحتوى (بالعربية)"
                  value={form.content_ar}
                  onChange={(e) => setField("content_ar", e.target.value)}
                  rows={18}
                  hint="Markdown مبسّط: ## عناوين، **عريض**، > اقتباس، قوائم مرقّمة."
                  required
                />
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          {/* Cover */}
          <Card padding="md">
            <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)] mb-3">
              {ar ? "صورة الغلاف" : "Image de couverture"}
            </h3>
            <div className="aspect-[16/9] rounded-xl overflow-hidden bg-[var(--color-surface-sunken)] mb-3 relative">
              {form.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.cover_image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.opacity = "0.3"; }}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--color-text-subtle)]">
                  <Icon name="image" className="h-8 w-8 mb-1" />
                  <span className="text-xs">{ar ? "بلا صورة" : "Aucune image"}</span>
                </div>
              )}
            </div>
            <Input
              label="URL"
              value={form.cover_image_url || ""}
              onChange={(e) => setField("cover_image_url", e.target.value)}
              placeholder="https://..."
              leadingIcon="image"
              hint={ar ? "ضع رابط صورة من Unsplash، Supabase Storage..." : "Lien vers une image (Unsplash, Supabase Storage, etc.)"}
            />
          </Card>

          {/* Meta */}
          <Card padding="md" className="space-y-4">
            <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
              {ar ? "بيانات وصفية" : "Métadonnées"}
            </h3>
            <Select
              label={ar ? "الفئة" : "Catégorie"}
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              options={CATEGORIES.map((c) => ({ value: c.value, label: ar ? c.ar : c.fr }))}
            />
            <Input
              type="number"
              label={ar ? "مدة القراءة (دقائق)" : "Temps de lecture (min)"}
              value={form.reading_time_minutes}
              onChange={(e) => setField("reading_time_minutes", e.target.value)}
              min="1"
              max="120"
            />
            <Input
              label={ar ? "الكاتب" : "Auteur"}
              value={form.author_name}
              onChange={(e) => setField("author_name", e.target.value)}
              placeholder="Smart Irrigation Team"
              leadingIcon="user"
            />
          </Card>

          {/* Publish */}
          <Card padding="md">
            <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)] mb-3">
              {ar ? "النشر" : "Publication"}
            </h3>
            <Switch
              label={ar ? "منشور" : "Publié"}
              description={
                ar
                  ? "إذا فعّلت، يظهر المقال في المدوّنة العمومية."
                  : "Si activé, l'article apparaît sur le blog public."
              }
              checked={isPublished}
              onChange={(v) => setField("published_at", v ? new Date().toISOString() : null)}
            />
            {isPublished && (
              <p className="mt-3 text-xs text-[var(--color-text-muted)] num">
                {ar ? "تاريخ النشر:" : "Publié le :"}{" "}
                {new Date(form.published_at).toLocaleString(ar ? "ar-MA" : "fr-FR", {
                  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}
          </Card>
        </aside>
      </div>

      {/* Sticky save bar */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] lg:start-64"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-text-muted)] hidden sm:block">
            {dirty
              ? (ar ? "تعديلات لم تُحفظ." : "Modifications non enregistrées.")
              : (ar ? "كل التعديلات محفوظة." : "Tout est enregistré.")}
          </p>
          <div className="flex items-center gap-2 ms-auto">
            {isEdit && (
              <Button
                onClick={() => save(isPublished ? false : true)}
                loading={saving}
                variant="secondary"
                size="md"
                leadingIcon={isPublished ? "close" : "send"}
              >
                {isPublished ? (ar ? "إلغاء النشر" : "Dépublier") : (ar ? "نشر" : "Publier")}
              </Button>
            )}
            <Button
              onClick={() => save(isEdit ? null : true)}
              loading={saving}
              size="md"
              leadingIcon="check"
            >
              {isEdit
                ? (ar ? "حفظ التغييرات" : "Enregistrer")
                : (ar ? "إنشاء ونشر" : "Créer et publier")}
            </Button>
            {!isEdit && (
              <Button
                onClick={() => save(false)}
                loading={saving}
                variant="secondary"
                size="md"
                leadingIcon="edit"
              >
                {ar ? "حفظ كمسودة" : "Enregistrer en brouillon"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
