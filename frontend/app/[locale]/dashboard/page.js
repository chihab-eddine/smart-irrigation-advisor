"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  MetricCard,
  Skeleton,
  Stat,
  cn,
} from "@/components/ui";
import { createAPIClient } from "@/lib/api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

export default function DashboardPage() {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState(null);
  const [irrigationTotal, setIrrigationTotal] = useState(0);
  const [diseaseTotal, setDiseaseTotal] = useState(0);
  const [irrigationData, setIrrigationData] = useState([]);
  const [diseaseData, setDiseaseData] = useState([]);

  useEffect(() => {
    if (user === null) router.replace(`/${locale}/login?next=/dashboard`);
  }, [user, locale, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) { setLoading(false); return; }
      setToken(session.access_token);
      try {
        const client = createAPIClient(session.access_token);
        const [irr, dis] = await Promise.all([
          client.getIrrigationHistory(60),
          client.getDiseaseHistory(30),
        ]);
        if (cancelled) return;
        setIrrigationTotal(irr?.total ?? 0);
        setDiseaseTotal(dis?.total ?? 0);
        setIrrigationData(irr?.data || []);
        setDiseaseData(dis?.data || []);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Erreur");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aggregate water-saved estimate (very rough — 30% efficiency gain assumption)
  const waterSaved = useMemo(() => {
    return irrigationData.reduce((sum, r) => sum + (r.water_savings?.savings_liters || 0), 0);
  }, [irrigationData]);

  // Build last-14-days mm chart
  const chartData = useMemo(() => {
    const map = new Map();
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, mm: 0 });
    }
    irrigationData.forEach((r) => {
      const key = (r.created_at || "").slice(0, 10);
      if (map.has(key)) map.get(key).mm += r.recommended_water_mm || 0;
    });
    return Array.from(map.values());
  }, [irrigationData]);

  const recent = irrigationData.slice(0, 5);
  const recentDis = diseaseData.slice(0, 5);

  return (
    <div className="page-container py-6 sm:py-10 max-w-5xl">
      <header className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <Badge variant="primary" icon="dashboard">{ar ? "تحليلات" : "Vue d'ensemble"}</Badge>
          <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
            {ar ? "تاريخك مع Saqi" : "Votre activité"}
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--color-text-muted)]">
            {ar
              ? "كل حساباتك وتشخيصاتك في مكان واحد."
              : "Toutes vos analyses, en un seul endroit."}
          </p>
        </div>
        <Button href={`/${locale}/today`} leadingIcon="sun" variant="secondary">
          {ar ? "اليوم" : "Aujourd'hui"}
        </Button>
      </header>

      {error && (
        <Banner tone="warning" title={ar ? "تعذر التحميل" : "Chargement impossible"}>
          {error}
        </Banner>
      )}

      {/* METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <>
            <Card padding="md"><Skeleton height={56} /></Card>
            <Card padding="md"><Skeleton height={56} /></Card>
            <Card padding="md"><Skeleton height={56} /></Card>
          </>
        ) : (
          <>
            <MetricCard
              icon="droplet"
              accent="primary"
              label={ar ? "حسابات الري" : "Calculs d'irrigation"}
              value={irrigationTotal.toLocaleString(ar ? "ar-MA" : "fr-FR")}
              hint={ar ? "منذ بداية استخدامك" : "depuis votre inscription"}
            />
            <MetricCard
              icon="leaf"
              accent="secondary"
              label={ar ? "تشخيصات الأمراض" : "Diagnostics"}
              value={diseaseTotal.toLocaleString(ar ? "ar-MA" : "fr-FR")}
              hint={ar ? "ورقة فُحصت" : "feuilles analysées"}
            />
            <MetricCard
              icon="cloud"
              accent="accent"
              label={ar ? "ماء موفّر (تقديري)" : "Eau économisée (estimée)"}
              value={Math.round(waterSaved).toLocaleString(ar ? "ar-MA" : "fr-FR")}
              unit="L"
              hint={ar ? "مقابل ري بالغمر" : "vs irrigation gravitaire"}
            />
          </>
        )}
      </div>

      {/* CHART */}
      <Card padding="md" className="mt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
            {ar ? "الري آخر 14 يوماً" : "Arrosage des 14 derniers jours"}
          </h3>
          <span className="text-xs text-[var(--color-text-muted)]">mm</span>
        </div>
        {loading ? (
          <Skeleton height={200} />
        ) : irrigationData.length === 0 ? (
          <EmptyState
            icon="droplet"
            title={ar ? "لا حسابات بعد" : "Aucun calcul pour l'instant"}
            description={ar ? "احسب أول توصية اليوم." : "Lancez votre premier calcul aujourd'hui."}
            action={<Button href={`/${locale}/irrigation`} leadingIcon="droplet">{ar ? "ابدأ" : "Commencer"}</Button>}
          />
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-text-muted)"
                  fontSize={10}
                  tickFormatter={(d) => {
                    try {
                      return new Intl.DateTimeFormat(ar ? "ar-MA" : "fr-FR", { day: "numeric" }).format(new Date(d));
                    } catch { return d; }
                  }}
                />
                <YAxis stroke="var(--color-text-muted)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="mm" fill="var(--color-primary-500)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* RECENT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
              {ar ? "آخر حسابات الري" : "Derniers calculs"}
            </h3>
            <Link href={`/${locale}/irrigation/history`} className="text-sm font-medium text-[var(--color-primary-700)] hover:underline">
              {ar ? "الكل" : "Tout voir"}
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              icon="droplet"
              title={ar ? "لا شيء بعد" : "Rien encore"}
              description={ar ? "ستظهر حساباتك هنا." : "Vos calculs apparaîtront ici."}
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border-subtle)]">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/${locale}/irrigation/history/${r.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-[var(--color-surface-muted)] -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <span className="h-9 w-9 rounded-xl bg-[var(--color-primary-100)] text-[var(--color-primary-700)] inline-flex items-center justify-center shrink-0">
                      <Icon name="droplet" className="h-4 w-4" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-strong)] truncate">
                        {r.crop_name} · {r.region_name}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {new Date(r.created_at).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--color-text-strong)] num">
                      {Math.round(r.recommended_water_mm || 0)} mm
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
              {ar ? "آخر تشخيصات" : "Derniers diagnostics"}
            </h3>
            <Link href={`/${locale}/disease/history`} className="text-sm font-medium text-[var(--color-primary-700)] hover:underline">
              {ar ? "الكل" : "Tout voir"}
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              <Skeleton height={40} />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </div>
          ) : recentDis.length === 0 ? (
            <EmptyState
              icon="leaf"
              title={ar ? "لا تشخيصات بعد" : "Aucun diagnostic"}
              description={ar ? "صوّر أول ورقة." : "Photographiez votre première feuille."}
              action={<Button href={`/${locale}/disease`} leadingIcon="image" size="sm">{ar ? "ابدأ" : "Commencer"}</Button>}
            />
          ) : (
            <ul className="divide-y divide-[var(--color-border-subtle)]">
              {recentDis.map((r) => {
                const name = (ar ? r.disease_name_ar : r.disease_name_fr) || r.disease_name || r.disease_key;
                const conf = Math.round((r.confidence_score || 0) * 100);
                const healthy = r.disease_key?.toLowerCase?.()?.includes("healthy");
                return (
                  <li key={r.id}>
                    <Link
                      href={`/${locale}/disease/history/${r.id}`}
                      className="flex items-center gap-3 py-3 hover:bg-[var(--color-surface-muted)] -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <span className={cn(
                        "h-9 w-9 rounded-xl inline-flex items-center justify-center shrink-0",
                        healthy
                          ? "bg-[var(--color-success-bg)] text-[var(--color-success)]"
                          : "bg-[var(--color-secondary-100)] text-[var(--color-secondary-700)]"
                      )}>
                        <Icon name="leaf" className="h-4 w-4" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-strong)] truncate">{name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {new Date(r.created_at).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--color-text-strong)] num">{conf}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
