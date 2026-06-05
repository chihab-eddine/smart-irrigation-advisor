"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import { createAPIClient } from "@/lib/api";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Input,
  MetricCard,
  Progress,
  Skeleton,
  Stat,
  ToastProvider,
  useToast,
  cn,
} from "@/components/ui";

const PER_PAGE = 20;

export default function AdminNewsletterPage() {
  return (
    <ToastProvider>
      <NewsletterInner />
    </ToastProvider>
  );
}

function NewsletterInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const { accessToken } = useAuth();
  const toast = useToast();

  const [subscribers, setSubscribers] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState("");

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const client = createAPIClient(accessToken);
      const [list, st] = await Promise.all([
        client.getAdminNewsletter(page),
        client.getNewsletterStats().catch(() => null),
      ]);
      setSubscribers(list?.data || []);
      setTotal(list?.total || 0);
      setStats(st);
    } catch (err) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, page]);

  const remove = async (id, email) => {
    if (!accessToken) return;
    if (!window.confirm(ar ? `إزالة ${email} من النشرة؟` : `Désabonner ${email} de la newsletter ?`)) return;
    setActionLoading(id);
    try {
      const client = createAPIClient(accessToken);
      await client.deleteNewsletterSubscriber(id);
      setSubscribers((prev) => prev.filter((s) => s.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      toast.push({ tone: "success", title: ar ? "تمت إزالة المشترك" : "Abonné supprimé" });
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setActionLoading(null);
    }
  };

  const exportCSV = () => {
    if (subscribers.length === 0) return;
    const header = ["email", "locale", "is_active", "subscribed_at"];
    const rows = subscribers.map((s) => [
      s.email,
      s.locale || "",
      s.is_active ? "yes" : "no",
      s.subscribed_at || "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saqi-newsletter-page-${page}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.push({
      tone: "success",
      title: ar ? "تم التصدير" : "Export téléchargé",
      description: `${subscribers.length} ${ar ? "صف" : "lignes"}`,
    });
  };

  const filtered = useMemo(() => {
    if (!search) return subscribers;
    const q = search.toLowerCase();
    return subscribers.filter((s) => (s.email || "").toLowerCase().includes(q));
  }, [subscribers, search]);

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const totalActive = stats?.active || 0;
  const totalInactive = stats?.inactive || 0;
  const frCount = stats?.by_locale?.fr || 0;
  const arCount = stats?.by_locale?.ar || 0;
  const totalLocale = frCount + arCount || 1;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Badge variant="primary" icon="mail">Newsletter</Badge>
          <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
            {ar ? "المشتركون" : "Abonnés"}
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--color-text-muted)]">
            {ar
              ? "إدارة قاعدة المشتركين والتصفيات."
              : "Gérez votre base d'abonnés et exportez."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportCSV} variant="secondary" leadingIcon="upload" disabled={subscribers.length === 0}>
            CSV
          </Button>
          <Button onClick={load} variant="ghost" leadingIcon="refresh" loading={loading}>
            {ar ? "تحديث" : "Actualiser"}
          </Button>
        </div>
      </header>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="md"><Skeleton height={56} /></Card>
          ))
        ) : (
          <>
            <MetricCard
              icon="users"
              accent="primary"
              label={ar ? "إجمالي" : "Total"}
              value={(stats.total || 0).toLocaleString(ar ? "ar-MA" : "fr-FR")}
            />
            <MetricCard
              icon="checkCircle"
              accent="success"
              label={ar ? "نشط" : "Actifs"}
              value={totalActive.toLocaleString(ar ? "ar-MA" : "fr-FR")}
            />
            <MetricCard
              icon="close"
              accent="warning"
              label={ar ? "غير نشط" : "Inactifs"}
              value={totalInactive.toLocaleString(ar ? "ar-MA" : "fr-FR")}
            />
            <Card padding="md">
              <p className="text-xs uppercase tracking-wider font-medium text-[var(--color-text-muted)]">
                {ar ? "حسب اللغة" : "Par langue"}
              </p>
              <div className="mt-3 space-y-2.5">
                <LocaleBar label={ar ? "فرنسي" : "Français"} value={frCount} total={totalLocale} tone="primary" ar={ar} />
                <LocaleBar label={ar ? "عربي" : "Arabe"} value={arCount} total={totalLocale} tone="secondary" ar={ar} />
              </div>
            </Card>
          </>
        )}
      </div>

      {error && <Banner tone="danger" title={ar ? "خطأ" : "Erreur"}>{error}</Banner>}

      {/* Search */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ar ? "تصفية بالبريد..." : "Filtrer par email…"}
          leadingIcon="search"
          className="sm:w-80"
        />
        <p className="text-sm text-[var(--color-text-muted)]">
          {filtered.length} {ar ? "/ " : "/ "} {subscribers.length} {ar ? "في هذه الصفحة" : "sur cette page"}
        </p>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} padding="md"><Skeleton height={40} /></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon="mail"
            title={ar ? "لا مشتركون" : "Aucun abonné"}
            description={
              search
                ? (ar ? "لا نتائج." : "Aucun résultat.")
                : (ar ? "لم يشترك أحد بعد." : "Personne ne s'est encore abonné.")
            }
          />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-[var(--color-surface-sunken)]">
                <tr>
                  <Th>Email</Th>
                  <Th>{ar ? "اللغة" : "Langue"}</Th>
                  <Th>{ar ? "الحالة" : "Statut"}</Th>
                  <Th>{ar ? "اشترك في" : "Abonné le"}</Th>
                  <Th className="text-end">{ar ? "إجراءات" : "Actions"}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-subtle)]">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--color-surface-muted)] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.email} size="sm" variant={s.is_active ? "primary" : "neutral"} />
                        <a
                          href={`mailto:${s.email}`}
                          className="text-sm font-medium text-[var(--color-text-strong)] hover:text-[var(--color-primary-700)] truncate"
                        >
                          {s.email}
                        </a>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={s.locale === "ar" ? "secondary" : "accent"} icon="languages" size="sm">
                        {s.locale === "ar" ? (ar ? "عربي" : "AR") : (ar ? "فرنسي" : "FR")}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {s.is_active ? (
                        <Badge variant="success" icon="checkCircle">{ar ? "نشط" : "Actif"}</Badge>
                      ) : (
                        <Badge variant="neutral" icon="close">{ar ? "غير نشط" : "Inactif"}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[var(--color-text-muted)] whitespace-nowrap">
                      {s.subscribed_at
                        ? new Date(s.subscribed_at).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-end">
                      <Button
                        onClick={() => remove(s.id, s.email)}
                        loading={actionLoading === s.id}
                        variant="ghost"
                        size="sm"
                        leadingIcon="trash"
                        className="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                      >
                        {ar ? "إزالة" : "Supprimer"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {total > PER_PAGE && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[var(--color-text-muted)]">
            {ar ? "صفحة" : "Page"} <span className="num font-semibold text-[var(--color-text-strong)]">{page}</span> / <span className="num">{pageCount}</span>
          </p>
          <div className="flex gap-2">
            <Button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} variant="secondary" size="sm" leadingIcon="chevronLeft">
              {ar ? "السابق" : "Précédent"}
            </Button>
            <Button onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount || loading} variant="secondary" size="sm" trailingIcon="chevronRight">
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

function LocaleBar({ label, value, total, tone, ar }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className="font-semibold text-[var(--color-text-strong)] num">
          {value.toLocaleString(ar ? "ar-MA" : "fr-FR")} <span className="text-[var(--color-text-muted)] font-normal">· {pct}%</span>
        </span>
      </div>
      <Progress value={pct} tone={tone} size="sm" />
    </div>
  );
}
