"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import { createAPIClient } from "@/lib/api";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  MetricCard,
  Progress,
  Skeleton,
  Stat,
  cn,
} from "@/components/ui";

export default function AdminDashboardPage() {
  const locale = useLocale();
  const ar = locale === "ar";
  const { accessToken } = useAuth();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const client = createAPIClient(accessToken);
        const res = await client.getAdminStats();
        if (!cancelled) setStats(res || null);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load admin stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken]);

  const totalPredictions = (stats?.total_irrigation || 0) + (stats?.total_disease || 0);
  const activeRatio = stats?.total_users
    ? Math.round((stats.active_users / stats.total_users) * 100)
    : 0;
  const subscriberRatio = stats?.total_newsletter
    ? Math.round((stats.active_subscribers / stats.total_newsletter) * 100)
    : 0;
  const unread = stats?.unread_messages || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <Badge variant="primary" icon="dashboard">
            {ar ? "الإدارة" : "Administration"}
          </Badge>
          <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
            {ar ? "نظرة عامة" : "Vue d'ensemble"}
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--color-text-muted)]">
            {ar
              ? "نظرة سريعة على نشاط المنصة وصحتها."
              : "Aperçu de l'activité et de la santé de la plateforme."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button href={`/${locale}/admin/users`} variant="secondary" leadingIcon="users" size="md">
            {ar ? "المستخدمون" : "Utilisateurs"}
          </Button>
          {unread > 0 && (
            <Button href={`/${locale}/admin/contacts`} leadingIcon="inbox" size="md">
              {unread} {ar ? "غير مقروء" : unread === 1 ? "non lu" : "non lus"}
            </Button>
          )}
        </div>
      </header>

      {error && (
        <Banner tone="danger" title={ar ? "تعذر التحميل" : "Chargement impossible"}>
          {error}
        </Banner>
      )}

      {/* === HEADLINE METRICS === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="md"><Skeleton height={56} /></Card>
          ))
        ) : (
          <>
            <MetricCard
              icon="users"
              accent="primary"
              label={ar ? "المستخدمون" : "Utilisateurs"}
              value={(stats?.total_users || 0).toLocaleString(ar ? "ar-MA" : "fr-FR")}
              hint={`${stats?.active_users || 0} ${ar ? "نشط" : "actifs"}`}
              href={`/${locale}/admin/users`}
            />
            <MetricCard
              icon="barChart"
              accent="accent"
              label={ar ? "التحاليل" : "Analyses totales"}
              value={totalPredictions.toLocaleString(ar ? "ar-MA" : "fr-FR")}
              hint={
                ar
                  ? `${stats?.total_irrigation || 0} ري · ${stats?.total_disease || 0} أمراض`
                  : `${stats?.total_irrigation || 0} irrig. · ${stats?.total_disease || 0} mal.`
              }
            />
            <MetricCard
              icon="inbox"
              accent={unread > 0 ? "warning" : "secondary"}
              label={ar ? "الرسائل" : "Messages"}
              value={(stats?.total_contacts || 0).toLocaleString(ar ? "ar-MA" : "fr-FR")}
              hint={
                unread > 0
                  ? `${unread} ${ar ? "بانتظارك" : unread === 1 ? "à traiter" : "à traiter"}`
                  : ar ? "كل شيء معالج" : "Tout est traité"
              }
              href={`/${locale}/admin/contacts`}
            />
            <MetricCard
              icon="mail"
              accent="success"
              label={ar ? "المشتركون" : "Abonnés newsletter"}
              value={(stats?.active_subscribers || 0).toLocaleString(ar ? "ar-MA" : "fr-FR")}
              hint={
                stats?.total_newsletter
                  ? `${subscriberRatio}% ${ar ? "نشط" : "actifs"}`
                  : (ar ? "لا أحد بعد" : "Personne pour l'instant")
              }
              href={`/${locale}/admin/newsletter`}
            />
          </>
        )}
      </div>

      {/* === BREAKDOWN ROW === */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Activity breakdown */}
        <Card padding="md" className="lg:col-span-2">
          <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)] mb-4">
            {ar ? "النشاط حسب الوحدة" : "Activité par module"}
          </h3>
          {loading ? (
            <div className="space-y-3">
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </div>
          ) : (
            <div className="space-y-4">
              <ActivityRow
                icon="droplet"
                tone="primary"
                label={ar ? "الري" : "Irrigation"}
                value={stats?.total_irrigation || 0}
                max={Math.max(stats?.total_irrigation || 0, stats?.total_disease || 0, 1)}
                ar={ar}
              />
              <ActivityRow
                icon="leaf"
                tone="secondary"
                label={ar ? "الأمراض" : "Diagnostics"}
                value={stats?.total_disease || 0}
                max={Math.max(stats?.total_irrigation || 0, stats?.total_disease || 0, 1)}
                ar={ar}
              />
              <ActivityRow
                icon="users"
                tone="accent"
                label={ar ? "المستخدمون النشطون" : "Utilisateurs actifs"}
                value={stats?.active_users || 0}
                max={Math.max(stats?.total_users || 0, 1)}
                ar={ar}
              />
            </div>
          )}
        </Card>

        {/* Engagement card */}
        <Card padding="md">
          <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)] mb-4">
            {ar ? "التفاعل" : "Engagement"}
          </h3>
          {loading ? (
            <Skeleton height={120} />
          ) : (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {ar ? "حسابات نشطة" : "Comptes actifs"}
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-text-strong)] num">
                    {activeRatio}%
                  </span>
                </div>
                <Progress value={activeRatio} tone="primary" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {ar ? "اشتراكات نشطة" : "Abonnements actifs"}
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-text-strong)] num">
                    {subscriberRatio}%
                  </span>
                </div>
                <Progress value={subscriberRatio} tone="success" />
              </div>
              <div className="pt-3 border-t border-[var(--color-border-subtle)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  {ar ? "الرسائل غير المقروءة" : "Messages non lus"}
                </p>
                <p className="display text-3xl text-[var(--color-text-strong)] num">{unread}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* === QUICK NAV === */}
      <Card padding="md">
        <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)] mb-4">
          {ar ? "اختصارات" : "Raccourcis"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { icon: "users", label: ar ? "المستخدمون" : "Utilisateurs", href: `/${locale}/admin/users` },
            { icon: "inbox", label: ar ? "الرسائل" : "Messages",        href: `/${locale}/admin/contacts` },
            { icon: "mail",  label: ar ? "النشرة" : "Newsletter",       href: `/${locale}/admin/newsletter` },
            { icon: "settings", label: ar ? "الإعدادات" : "Configuration", href: `/${locale}/admin/config` },
          ].map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-2xl border border-[var(--color-border)]",
                "bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]",
                "hover:border-[var(--color-primary-300)] transition-colors text-center"
              )}
            >
              <span className="h-10 w-10 rounded-xl bg-[var(--color-primary-100)] text-[var(--color-primary-700)] inline-flex items-center justify-center">
                <Icon name={q.icon} className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-[var(--color-text-strong)]">{q.label}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ActivityRow({ icon, tone, label, value, max, ar }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const TONE = {
    primary: "bg-[var(--color-primary-100)] text-[var(--color-primary-700)]",
    secondary: "bg-[var(--color-secondary-100)] text-[var(--color-secondary-700)]",
    accent: "bg-[var(--color-accent-100)] text-[var(--color-accent-700)]",
  };
  return (
    <div className="flex items-center gap-3">
      <span className={cn("h-9 w-9 inline-flex items-center justify-center rounded-xl shrink-0", TONE[tone])}>
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-[var(--color-text-strong)]">{label}</span>
          <span className="text-sm font-semibold text-[var(--color-text-strong)] num">
            {value.toLocaleString(ar ? "ar-MA" : "fr-FR")}
          </span>
        </div>
        <Progress value={pct} tone={tone} size="sm" />
      </div>
    </div>
  );
}
