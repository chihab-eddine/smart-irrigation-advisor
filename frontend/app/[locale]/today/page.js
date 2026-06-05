"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Sheet,
  Skeleton,
  Stat,
  Tag,
  ToastProvider,
  useToast,
  Avatar,
  Badge,
  cn,
} from "@/components/ui";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import { openAgronomistChat } from "@/components/AgronomistChat";
import {
  getActivePlot,
  hasOnboarded,
  lastIrrigationForPlot,
  listPlots,
  logIrrigation,
  setActivePlotId,
  subscribePlots,
} from "@/lib/plots";
import { createAPIClient } from "@/lib/api";

// Locale-specific crop display: maps the FR canonical name to AR.
const CROP_AR = {
  "Blé": "قمح",
  "Maïs": "ذرة",
  "Tomate": "طماطم",
  "Olivier": "زيتون",
  "Agrumes": "حوامض",
  "Pomme de terre": "بطاطس",
  "Luzerne": "فصة",
  "Betterave sucrière": "شمندر سكري",
  "Oignon": "بصل",
  "Haricot": "فاصوليا",
};

function greeting(locale) {
  const h = new Date().getHours();
  if (locale === "ar") {
    if (h < 12) return "صباح الخير";
    if (h < 18) return "نهارك سعيد";
    return "مساء الخير";
  }
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function formatDate(d, locale) {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(d);
  } catch {
    return d.toDateString();
  }
}

export default function TodayPage() {
  return (
    <ToastProvider>
      <TodayInner />
    </ToastProvider>
  );
}

function TodayInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const toast = useToast();

  const [plots, setPlots] = useState([]);
  const [plot, setPlot] = useState(null);
  const [lastIrr, setLastIrr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [plotsSheetOpen, setPlotsSheetOpen] = useState(false);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (user === null) router.replace(`/${locale}/login?next=/today`);
  }, [user, locale, router]);

  // Onboarding gate
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasOnboarded() && listPlots().length === 0) {
      router.replace(`/${locale}/onboarding`);
    }
  }, [locale, router]);

  // Plot bootstrap + subscribe
  useEffect(() => {
    const refresh = () => {
      const all = listPlots();
      const active = getActivePlot();
      setPlots(all);
      setPlot(active);
      setLastIrr(active ? lastIrrigationForPlot(active.id) : null);
    };
    refresh();
    return subscribePlots(refresh);
  }, []);

  // Fetch prediction whenever the active plot changes
  useEffect(() => {
    let cancelled = false;
    if (!plot) {
      setLoading(false);
      setResult(null);
      return;
    }
    // Wait for the access token to hydrate before hitting protected endpoints
    if (!accessToken) {
      setLoading(true);
      return;
    }
    setLoading(true);
    setError("");
    (async () => {
      try {
        const client = createAPIClient(accessToken);
        // Load reference data to map crop/region names → ids
        const [crops, regions, soils] = await Promise.all([
          client.getCrops(),
          client.getRegions(),
          client.getSoilTypes(),
        ]);
        const findBy = (list, val) =>
          list.find((x) => x.id === val) ||
          list.find((x) => x.name_fr === val) ||
          list.find((x) => x.name_ar === val);
        const crop = findBy(crops, plot.crop) || crops[0];
        const region = findBy(regions, plot.region) || regions[0];
        const soil = findBy(soils, plot.soil) || soils[0];
        if (!crop || !region || !soil) throw new Error("reference data missing");

        const body = {
          crop_id: crop.id,
          soil_type_id: soil.id,
          region_id: region.id,
          planting_date: plot.plantingDate || undefined,
          locale,
          irrigation_method: plot.irrigationSystem || "drip",
          land_size_m2: plot.landSize || undefined,
          drip_flow_rate_lph: plot.emitterRate || undefined,
        };
        const res = await client.predictIrrigation(body);
        if (!cancelled) setResult(res);
      } catch (e) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plot, locale, accessToken]);

  const cropLabel = useMemo(() => {
    if (!plot) return "";
    return ar ? (CROP_AR[plot.crop] || plot.crop) : plot.crop || "";
  }, [plot, ar]);

  const onMarkWatered = () => {
    if (!plot || !result) return;
    logIrrigation({
      plotId: plot.id,
      amountMm: Math.round(result.gross_water_mm || result.recommended_water_mm || 0),
    });
    setLastIrr({ plotId: plot.id, amountMm: result.gross_water_mm, at: new Date().toISOString() });
    toast.push({
      tone: "success",
      title: ar ? "تم تسجيل الري" : "Arrosage enregistré",
      description: ar
        ? `${Math.round(result.gross_water_mm)} مم تم تطبيقها`
        : `${Math.round(result.gross_water_mm)} mm appliqués`,
    });
  };

  const wateredToday = useMemo(() => {
    if (!lastIrr) return false;
    const d = new Date(lastIrr.at);
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }, [lastIrr]);

  return (
    <div className="min-h-[100dvh]">
      {/* Header strip with gradient */}
      <section
        className="relative"
        style={{ background: "var(--gradient-sunrise)" }}
      >
        <div className="page-container pt-6 pb-8 sm:pt-10 sm:pb-12">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-muted)]">
                {greeting(locale)}
                {user?.user_metadata?.full_name
                  ? `, ${user.user_metadata.full_name.split(" ")[0]}`
                  : ""}
              </p>
              <h1 className="display text-2xl sm:text-3xl text-[var(--color-text-strong)] mt-1">
                {formatDate(new Date(), locale)}
              </h1>
            </div>
            <div className="flex items-center gap-1.5">
              <Link
                href={`/${locale}/profile`}
                className="h-10 w-10 inline-flex items-center justify-center rounded-full bg-[var(--color-surface)]/60 backdrop-blur"
                aria-label="Profile"
              >
                <Avatar name={user?.user_metadata?.full_name || user?.email} size="xs" />
              </Link>
            </div>
          </div>

          {/* Plot switcher */}
          {plot && (
            <button
              type="button"
              onClick={() => setPlotsSheetOpen(true)}
              className={cn(
                "mt-5 inline-flex items-center gap-2 h-10 px-3 rounded-full",
                "bg-[var(--color-surface)]/80 backdrop-blur border border-[var(--color-border)]",
                "text-sm font-medium text-[var(--color-text-strong)]"
              )}
            >
              <Icon name="sprout" className="h-4 w-4 text-[var(--color-primary-700)]" />
              <span className="truncate max-w-[180px]">{plot.name}</span>
              <Icon name="chevronDown" className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
            </button>
          )}
        </div>
      </section>

      <section className="page-container -mt-6 space-y-6 pb-8">
        {/* HERO ANSWER CARD */}
        {!plot && !loading ? (
          <Card padding="lg" className="text-center">
            <EmptyState
              icon="sprout"
              title={ar ? "ابدأ بإضافة قطعتك" : "Ajoutez votre parcelle"}
              description={
                ar
                  ? "خذ دقيقة لإعداد قطعتك. ستحصل بعدها على توصية يومية في ثانيتين."
                  : "Une minute pour décrire votre parcelle. Ensuite, une réponse claire en deux secondes chaque jour."
              }
              action={
                <Button
                  href={`/${locale}/onboarding`}
                  size="lg"
                  trailingIcon="arrowRight"
                >
                  {ar ? "إعداد قطعة" : "Configurer ma parcelle"}
                </Button>
              }
            />
          </Card>
        ) : (
          <HeroCard
            loading={loading}
            error={error}
            result={result}
            plotName={plot?.name}
            cropLabel={cropLabel}
            wateredToday={wateredToday}
            onMarkWatered={onMarkWatered}
            locale={locale}
          />
        )}

        {/* 7-DAY FORECAST STRIP */}
        {result && !loading && (
          <WeekStrip forecast={result.forecast} ar={ar} />
        )}

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card
            href={`/${locale}/disease`}
            interactive
            surface="leaf"
            padding="md"
          >
            <div className="flex items-start gap-4">
              <span className="h-12 w-12 inline-flex items-center justify-center rounded-2xl bg-[var(--color-primary-600)] text-white shrink-0">
                <Icon name="image" className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
                  {ar ? "ورقة تبدو مريضة؟" : "Une feuille suspecte ?"}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {ar
                    ? "صوّرها. سنقترح علاجاً في ثوانٍ."
                    : "Photographiez-la. Diagnostic et conseils en quelques secondes."}
                </p>
              </div>
            </div>
          </Card>

          <Card
            as="button"
            onClick={() => openAgronomistChat()}
            interactive
            surface="sky"
            padding="md"
            className="text-left rtl:text-right w-full"
          >
            <div className="flex items-start gap-4">
              <span className="h-12 w-12 inline-flex items-center justify-center rounded-2xl bg-[var(--color-accent-500)] text-white shrink-0">
                <Icon name="send" className="h-6 w-6 rtl-flip" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
                  {ar ? "اسأل الاستشاري" : "Demandez à l'agronome"}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {ar
                    ? "سؤال حول الري، الأمراض، التربة أو الطقس."
                    : "Une question sur l'eau, les maladies, le sol ou la météo."}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* RECENT ACTIVITY */}
        {plots.length > 0 && (
          <Card padding="md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
                {ar ? "كل قطعك" : "Toutes vos parcelles"}
              </h3>
              <Link
                href={`/${locale}/profile?tab=plots`}
                className="text-sm font-medium text-[var(--color-primary-700)] hover:underline"
              >
                {ar ? "إدارة" : "Gérer"}
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {plots.map((p) => (
                <Tag
                  key={p.id}
                  onClick={() => setActivePlotId(p.id)}
                  selected={plot?.id === p.id}
                  icon="sprout"
                >
                  {p.name}
                </Tag>
              ))}
              <Tag onClick={() => router.push(`/${locale}/onboarding?add=1`)} icon="check">
                {ar ? "إضافة" : "Ajouter"}
              </Tag>
            </div>
          </Card>
        )}
      </section>

      {/* PLOTS SHEET */}
      <Sheet
        open={plotsSheetOpen}
        onClose={() => setPlotsSheetOpen(false)}
        title={ar ? "اختر قطعة" : "Choisir une parcelle"}
        description={ar ? "بدّل بين قطعك المحفوظة." : "Basculez entre vos parcelles enregistrées."}
      >
        <div className="space-y-2">
          {plots.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActivePlotId(p.id);
                setPlotsSheetOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left rtl:text-right transition-colors",
                plot?.id === p.id
                  ? "bg-[var(--color-primary-100)] border-[var(--color-primary-300)]"
                  : "bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
              )}
            >
              <span className="h-10 w-10 shrink-0 rounded-xl bg-[var(--color-primary-600)] text-white inline-flex items-center justify-center">
                <Icon name="sprout" className="h-5 w-5" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium text-[var(--color-text-strong)] truncate">{p.name}</p>
                <p className="text-sm text-[var(--color-text-muted)] truncate">
                  {(ar ? CROP_AR[p.crop] || p.crop : p.crop)} · {p.region}
                </p>
              </div>
              {plot?.id === p.id && (
                <Icon name="check" className="h-5 w-5 text-[var(--color-primary-700)] shrink-0" />
              )}
            </button>
          ))}
          <Button
            href={`/${locale}/onboarding?add=1`}
            variant="secondary"
            fullWidth
            leadingIcon="check"
          >
            {ar ? "إضافة قطعة جديدة" : "Ajouter une nouvelle parcelle"}
          </Button>
        </div>
      </Sheet>

    </div>
  );
}

/* -------------------------------------------------------------------------- */

function HeroCard({ loading, error, result, plotName, cropLabel, wateredToday, onMarkWatered, locale }) {
  const ar = locale === "ar";

  if (loading) {
    return (
      <Card padding="lg" surface="raised" radius="lg">
        <div className="space-y-4">
          <Skeleton height={14} width="40%" />
          <Skeleton height={64} width="60%" />
          <Skeleton height={14} width="80%" />
          <div className="flex gap-2 pt-2">
            <Skeleton height={48} width={180} />
            <Skeleton height={48} width={120} />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Banner
        tone="warning"
        title={ar ? "تعذر الحساب" : "Calcul impossible"}
      >
        {ar
          ? "تحقق من الاتصال أو أعد المحاولة. آخر توصية ما زالت تنطبق."
          : "Vérifiez votre connexion ou réessayez. La dernière recommandation reste valable."}
      </Banner>
    );
  }

  if (!result) return null;

  const water = Math.round(result.gross_water_mm || result.recommended_water_mm || 0);
  const totalLiters = result.total_water_liters ? Math.round(result.total_water_liters) : null;
  const alert = result.alert_level || "normal";
  const weather = result.weather_summary || {};
  const recommendation = result.recommendation || "";

  return (
    <Card padding="lg" surface="raised" radius="lg" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-sm text-[var(--color-text-muted)]">
          {ar ? "اليوم لـ" : "Aujourd'hui pour"} <span className="font-medium text-[var(--color-text-strong)]">{plotName}</span>
        </p>
        <AlertChip level={alert} ar={ar} />
      </div>

      <p className="text-[15px] text-[var(--color-text)] mt-1">
        {ar ? "تحتاج" : "Vos"} {cropLabel.toLowerCase()} {ar ? "إلى" : "ont besoin de"}
      </p>

      <div className="flex items-end gap-3 mt-2">
        <span className="display text-[68px] sm:text-[88px] leading-none text-[var(--color-text-strong)] num">
          {water}
        </span>
        <div className="pb-3">
          <p className="text-xl font-semibold text-[var(--color-text-strong)]">mm</p>
          {totalLiters ? (
            <p className="text-sm text-[var(--color-text-muted)] num">
              ≈ {totalLiters.toLocaleString(ar ? "ar-MA" : "fr-FR")} L
            </p>
          ) : null}
        </div>
      </div>

      {/* Weather mini-row */}
      <div className="mt-4 flex items-center gap-4 text-sm text-[var(--color-text-muted)]">
        {weather.temperature_max != null && (
          <span className="inline-flex items-center gap-1">
            <Icon name="thermometer" className="h-4 w-4" />
            {Math.round(weather.temperature_max)}°
          </span>
        )}
        {weather.humidity_avg != null && (
          <span className="inline-flex items-center gap-1">
            <Icon name="droplet" className="h-4 w-4" />
            {Math.round(weather.humidity_avg)}%
          </span>
        )}
        {weather.wind_speed != null && (
          <span className="inline-flex items-center gap-1">
            <Icon name="wind" className="h-4 w-4" />
            {Math.round(weather.wind_speed)} km/h
          </span>
        )}
      </div>

      {recommendation && (
        <p className="mt-4 text-[15px] text-[var(--color-text)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-4">
          {recommendation}
        </p>
      )}

      <div className="mt-5 flex flex-col sm:flex-row gap-2">
        {wateredToday ? (
          <Button variant="tonal" size="lg" leadingIcon="checkCircle" disabled fullWidth>
            {ar ? "تم الري اليوم" : "Arrosé aujourd'hui"}
          </Button>
        ) : (
          <Button onClick={onMarkWatered} size="lg" leadingIcon="checkCircle" fullWidth>
            {ar ? "تسجيل الري" : "Marquer comme arrosé"}
          </Button>
        )}
        <Button
          variant="secondary"
          href={`/${locale}/irrigation`}
          size="lg"
          trailingIcon="arrowRight"
        >
          {ar ? "تفاصيل" : "Détails"}
        </Button>
      </div>
    </Card>
  );
}

function AlertChip({ level, ar }) {
  if (level === "critical") {
    return (
      <Badge variant="danger" icon="alertTriangle">
        {ar ? "حرج" : "Critique"}
      </Badge>
    );
  }
  if (level === "warning") {
    return (
      <Badge variant="warning" icon="alertCircle">
        {ar ? "تنبيه" : "Attention"}
      </Badge>
    );
  }
  return (
    <Badge variant="success" icon="checkCircle">
      {ar ? "عادي" : "Optimal"}
    </Badge>
  );
}

function WeekStrip({ forecast, ar }) {
  if (!forecast || forecast.length === 0) return null;
  const days = forecast.slice(0, 7);
  const dayLabel = (iso) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat(ar ? "ar-MA" : "fr-FR", { weekday: "short" }).format(d);
    } catch {
      return "";
    }
  };
  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
          {ar ? "هذا الأسبوع" : "Cette semaine"}
        </h3>
        <span className="text-xs text-[var(--color-text-muted)]">{ar ? "كمية الري بالملم" : "mm / jour"}</span>
      </div>
      <div className="flex items-end justify-between gap-1">
        {days.map((d, i) => {
          const dayMm = (x) => Math.max(0, Number(x.eto || 0) - Number(x.precipitation || 0) * 0.8);
          const max = Math.max(...days.map(dayMm), 1);
          const mm = Math.round(dayMm(d));
          const pct = Math.max((mm / max) * 100, 6);
          const rain = (d.precipitation || 0) > 0.5;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
              <span className="text-[10px] font-semibold text-[var(--color-text-strong)] num">
                {mm}
              </span>
              <div className="w-full h-20 flex items-end">
                <div
                  className={cn(
                    "w-full rounded-md transition-all",
                    rain ? "bg-[var(--color-accent-400)]" : "bg-[var(--color-primary-500)]"
                  )}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)] truncate w-full text-center">
                {dayLabel(d.date)}
              </span>
              {rain && (
                <Icon name="cloudRain" className="h-3 w-3 text-[var(--color-accent-600)]" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

