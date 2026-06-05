"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import {
  Badge,
  Banner,
  Button,
  Card,
  Input,
  Progress,
  Select,
  Skeleton,
  SkeletonText,
  Stat,
  Tabs,
  Tag,
  ToastProvider,
  useToast,
  cn,
} from "@/components/ui";
import { createAPIClient } from "@/lib/api";
import {
  getActivePlot,
  listPlots,
  lastIrrigationForPlot,
  logIrrigation,
  setActivePlotId,
  subscribePlots,
} from "@/lib/plots";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const SYSTEM_OPTIONS = [
  { key: "drip",      fr: "Goutte-à-goutte",  ar: "بالتنقيط",  efficiency: "90%" },
  { key: "sprinkler", fr: "Aspersion",         ar: "بالرش",     efficiency: "75%" },
  { key: "surface",   fr: "Gravitaire",         ar: "بالغمر",    efficiency: "55%" },
];

const SYSTEM_LABEL = Object.fromEntries(SYSTEM_OPTIONS.map((s) => [s.key, s]));

export default function IrrigationPage() {
  return (
    <ToastProvider>
      <IrrigationInner />
    </ToastProvider>
  );
}

function IrrigationInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const toast = useToast();

  useEffect(() => {
    if (user === null) router.replace(`/${locale}/login?next=/irrigation`);
  }, [user, locale, router]);

  const [plots, setPlots] = useState([]);
  const [plot, setPlot] = useState(null);
  const [refs, setRefs] = useState({ crops: [], regions: [], soils: [] });
  const [refLoading, setRefLoading] = useState(true);

  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("plot");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // AI recommendation state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState("");

  // Manual form
  const [cropName, setCropName] = useState("");
  const [regionName, setRegionName] = useState("");
  const [soilName, setSoilName] = useState("Limoneux");
  const [plantingDate, setPlantingDate] = useState("");
  const [landSize, setLandSize] = useState("");
  const [system, setSystem] = useState("drip");
  const [dripFlow, setDripFlow] = useState("4");

  useEffect(() => {
    const refresh = () => {
      const all = listPlots();
      setPlots(all);
      const active = getActivePlot();
      setPlot(active);
      if (active) {
        setCropName(active.crop || "");
        setRegionName(active.region || "");
        setSoilName(active.soil || "Limoneux");
        setSystem(active.irrigationSystem || "drip");
        setPlantingDate(active.plantingDate || "");
        setLandSize(active.landSize ? String(active.landSize) : "");
        setDripFlow(active.emitterRate ? String(active.emitterRate) : "4");
      }
    };
    refresh();
    return subscribePlots(refresh);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const client = createAPIClient();
        const [crops, regions, soils] = await Promise.all([
          client.getCrops(),
          client.getRegions(),
          client.getSoilTypes(),
        ]);
        setRefs({ crops, regions, soils });
      } catch {
        setError(ar ? "تعذر تحميل البيانات المرجعية." : "Impossible de charger les références.");
      } finally {
        setRefLoading(false);
      }
    })();
  }, [ar]);

  useEffect(() => {
    if (mode !== "plot" || !plot || refLoading || refs.crops.length === 0 || !accessToken) return;
    compute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plot, refLoading, refs, mode, locale, accessToken]);

  const compute = async () => {
    if (!accessToken) {
      setError(ar ? "جارٍ تحضير الجلسة..." : "Préparation de la session…");
      return;
    }
    setComputing(true);
    setError("");
    setResult(null);
    setAiText("");
    setAiError("");
    try {
      const client = createAPIClient(accessToken);

      const cropQuery   = mode === "plot" ? plot?.crop   : cropName;
      const regionQuery = mode === "plot" ? plot?.region : regionName;
      const soilQuery   = mode === "plot" ? plot?.soil   : soilName;

      const findBy = (list, val) =>
        list.find((x) => x.id === val) ||
        list.find((x) => x.name_fr === val) ||
        list.find((x) => x.name_ar === val);

      const crop = findBy(refs.crops, cropQuery);
      const region = findBy(refs.regions, regionQuery);
      const soil = findBy(refs.soils, soilQuery);

      if (!crop || !region || !soil) {
        throw new Error(ar ? "يرجى ملء كل الحقول." : "Veuillez compléter tous les champs.");
      }

      const body = {
        crop_id: crop.id,
        soil_type_id: soil.id,
        region_id: region.id,
        planting_date: (mode === "plot" ? plot?.plantingDate : plantingDate) || undefined,
        locale,
        irrigation_method: mode === "plot" ? plot?.irrigationSystem || "drip" : system,
        land_size_m2: (mode === "plot" ? plot?.landSize : Number(landSize)) || undefined,
        drip_flow_rate_lph: (mode === "plot" ? plot?.emitterRate : Number(dripFlow)) || undefined,
      };
      const res = await client.predictIrrigation(body);
      setResult(res);

      // Fire AI recommendation in the background — non-blocking
      if (res?.id) {
        fetchAi(client, res.id);
      }
    } catch (e) {
      setError(String(e?.message || e));
    } finally {
      setComputing(false);
    }
  };

  const fetchAi = async (client, predictionId) => {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await client.getIrrigationAIRecommendation(predictionId, locale);
      setAiText(res?.text || "");
    } catch (e) {
      // 503 = Gemini not configured. Show a soft fallback rather than an alarming error.
      const msg = String(e?.message || "");
      if (e?.status === 503 || msg.toLowerCase().includes("gemini")) {
        setAiError("not_configured");
      } else {
        setAiError(msg || (ar ? "تعذر توليد التوصية الذكية." : "Conseil IA indisponible."));
      }
    } finally {
      setAiLoading(false);
    }
  };

  const onMarkWatered = () => {
    if (!result) return;
    if (plot) {
      logIrrigation({
        plotId: plot.id,
        amountMm: Math.round(result.gross_water_mm || result.recommended_water_mm || 0),
      });
    }
    toast.push({ tone: "success", title: ar ? "تم تسجيل الري" : "Arrosage enregistré" });
  };

  const lastIrr = plot ? lastIrrigationForPlot(plot.id) : null;
  const wateredToday = useMemo(() => {
    if (!lastIrr) return false;
    const d = new Date(lastIrr.at);
    const n = new Date();
    return d.toDateString() === n.toDateString();
  }, [lastIrr]);

  return (
    <div className="page-container py-6 sm:py-10 max-w-4xl">
      <header className="mb-6">
        <Badge variant="primary" icon="droplet">{ar ? "الري" : "Irrigation"}</Badge>
        <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
          {ar ? "خطة الري اليوم" : "Votre plan d'arrosage"}
        </h1>
        <p className="mt-2 text-[15px] text-[var(--color-text-muted)] max-w-xl">
          {ar
            ? "حساب يومي مبني على الطقس المحلي ومحصولك المختار، مع نصائح مخصصة لك."
            : "Calcul quotidien basé sur la météo locale et votre culture, avec des conseils personnalisés."}
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { value: "plot", label: ar ? "قطعتي" : "Ma parcelle" },
            { value: "manual", label: ar ? "حساب حر" : "Calcul libre" },
          ]}
          value={mode}
          onChange={setMode}
        />
        {mode === "plot" && plots.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {plots.map((p) => (
              <Tag key={p.id} onClick={() => setActivePlotId(p.id)} selected={plot?.id === p.id} icon="sprout">
                {p.name}
              </Tag>
            ))}
            <Button href={`/${locale}/onboarding?add=1`} variant="ghost" size="sm" leadingIcon="check">
              {ar ? "إضافة" : "Ajouter"}
            </Button>
          </div>
        )}
      </div>

      {mode === "plot" && (
        <>
          {!plot && (
            <Banner tone="info" title={ar ? "لا قطعة محفوظة بعد" : "Aucune parcelle enregistrée"}>
              <span>
                {ar
                  ? "أعدّ قطعة في أقل من دقيقتين لتحصل على حساب تلقائي كل يوم."
                  : "Configurez une parcelle en moins de deux minutes pour un calcul automatique chaque jour."}{" "}
              </span>
              <Link href={`/${locale}/onboarding`} className="font-semibold text-[var(--color-primary-700)] hover:underline">
                {ar ? "ابدأ" : "Commencer"}
              </Link>
            </Banner>
          )}

          {plot && (
            <ResultPanel
              loading={computing || refLoading}
              error={error}
              result={result}
              plot={plot}
              locale={locale}
              ar={ar}
              wateredToday={wateredToday}
              onMarkWatered={onMarkWatered}
              onRefresh={compute}
              showAdvanced={showAdvanced}
              setShowAdvanced={setShowAdvanced}
              aiLoading={aiLoading}
              aiText={aiText}
              aiError={aiError}
            />
          )}
        </>
      )}

      {mode === "manual" && (
        <Card padding="lg">
          {refLoading ? (
            <div className="space-y-3">
              <Skeleton height={48} />
              <Skeleton height={48} />
              <Skeleton height={48} />
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); compute(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label={ar ? "المحصول" : "Culture"}
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  placeholder={ar ? "اختر..." : "Choisir…"}
                  options={refs.crops.map((c) => ({ value: c.name_fr, label: ar ? c.name_ar : c.name_fr }))}
                  required
                />
                <Select
                  label={ar ? "المنطقة" : "Région"}
                  value={regionName}
                  onChange={(e) => setRegionName(e.target.value)}
                  placeholder={ar ? "اختر..." : "Choisir…"}
                  options={refs.regions.map((r) => ({ value: r.name_fr, label: ar ? r.name_ar : r.name_fr }))}
                  required
                />
                <Select
                  label={ar ? "التربة" : "Sol"}
                  value={soilName}
                  onChange={(e) => setSoilName(e.target.value)}
                  options={refs.soils.map((s) => ({ value: s.name_fr, label: ar ? s.name_ar : s.name_fr }))}
                />
                <Input
                  type="date"
                  label={ar ? "تاريخ الزرع (اختياري)" : "Date de plantation (optionnel)"}
                  value={plantingDate}
                  onChange={(e) => setPlantingDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select
                  label={ar ? "نظام الري" : "Système d'irrigation"}
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  options={SYSTEM_OPTIONS.map((s) => ({ value: s.key, label: ar ? s.ar : s.fr }))}
                />
                <Input
                  type="number"
                  label={ar ? "مساحة القطعة (م²)" : "Surface (m²)"}
                  value={landSize}
                  onChange={(e) => setLandSize(e.target.value)}
                  placeholder="1000"
                />
                {system === "drip" && (
                  <Input
                    type="number"
                    label={ar ? "تدفق المنقّط (ل/س)" : "Débit goutteur (L/h)"}
                    value={dripFlow}
                    onChange={(e) => setDripFlow(e.target.value)}
                    placeholder="4"
                  />
                )}
              </div>

              <div className="pt-2">
                <Button type="submit" loading={computing} size="lg" leadingIcon="check" fullWidth>
                  {ar ? "احسب" : "Calculer"}
                </Button>
              </div>
            </form>
          )}

          {(error || result) && (
            <div className="mt-6">
              <ResultPanel
                loading={computing}
                error={error}
                result={result}
                plot={null}
                locale={locale}
                ar={ar}
                wateredToday={false}
                onMarkWatered={onMarkWatered}
                onRefresh={compute}
                showAdvanced={showAdvanced}
                setShowAdvanced={setShowAdvanced}
                aiLoading={aiLoading}
                aiText={aiText}
                aiError={aiError}
              />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* =========================================================================== */

function ResultPanel({
  loading, error, result, plot, locale, ar,
  wateredToday, onMarkWatered, onRefresh,
  showAdvanced, setShowAdvanced,
  aiLoading, aiText, aiError,
}) {
  if (loading) {
    return (
      <Card padding="lg" surface="raised">
        <Skeleton height={20} width="40%" />
        <div className="my-4"><Skeleton height={72} width="60%" /></div>
        <Skeleton height={14} />
        <div className="mt-2"><Skeleton height={14} width="80%" /></div>
      </Card>
    );
  }

  if (error) {
    return <Banner tone="warning" title={ar ? "تعذر الحساب" : "Calcul impossible"}>{error}</Banner>;
  }

  if (!result) return null;

  const water = Math.round(result.gross_water_mm || result.recommended_water_mm || 0);
  const netWater = Math.round(result.recommended_water_mm || 0);
  const totalL = result.total_water_liters ? Math.round(result.total_water_liters) : null;
  const drip = result.drip_info || {};
  const savings = result.water_savings || {};
  const harvest = result.harvest_estimate || {};
  const weather = result.weather_summary || {};
  const alert = result.alert_level || "normal";
  const system = result.irrigation_method || plot?.irrigationSystem || "drip";
  const efficiency = result.irrigation_efficiency
    ? Math.round(result.irrigation_efficiency * 100)
    : null;

  return (
    <div className="space-y-5">
      {/* === HERO ANSWER CARD === */}
      <Card padding="lg" surface="raised" radius="lg" className="overflow-hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-[var(--color-text-muted)]">
              {plot
                ? <>{ar ? "اليوم لـ" : "Aujourd'hui pour"} <span className="font-medium text-[var(--color-text-strong)]">{plot.name}</span></>
                : ar ? "النتيجة" : "Résultat"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              {result.crop_name} · {result.region_name} · {result.soil_type_name}
            </p>
          </div>
          <AlertChip level={alert} ar={ar} />
        </div>

        <div className="mt-5 flex items-end gap-3 flex-wrap">
          <span className="display text-[64px] sm:text-[88px] leading-none text-[var(--color-text-strong)] num">
            {water}
          </span>
          <div className="pb-3">
            <p className="text-xl font-semibold text-[var(--color-text-strong)]">mm</p>
            {totalL ? (
              <p className="text-sm text-[var(--color-text-muted)] num">
                ≈ {totalL.toLocaleString(ar ? "ar-MA" : "fr-FR")} L
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--color-text-muted)]">
          {weather.temperature_max != null && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="thermometer" className="h-4 w-4" /> {Math.round(weather.temperature_max)}° max
            </span>
          )}
          {weather.humidity_avg != null && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="droplet" className="h-4 w-4" /> {Math.round(weather.humidity_avg)}%
            </span>
          )}
          {weather.wind_speed != null && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="wind" className="h-4 w-4" /> {Math.round(weather.wind_speed)} km/h
            </span>
          )}
        </div>

        {result.recommendation && (
          <p className="mt-4 text-[15px] text-[var(--color-text)] leading-relaxed border-t border-[var(--color-border-subtle)] pt-4">
            {result.recommendation}
          </p>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-2">
          {plot ? (
            wateredToday ? (
              <Button variant="tonal" size="lg" leadingIcon="checkCircle" disabled fullWidth>
                {ar ? "تم الري اليوم" : "Arrosé aujourd'hui"}
              </Button>
            ) : (
              <Button onClick={onMarkWatered} size="lg" leadingIcon="checkCircle" fullWidth>
                {ar ? "تسجيل الري" : "Marquer comme arrosé"}
              </Button>
            )
          ) : null}
          <Button onClick={onRefresh} variant="secondary" size="lg" leadingIcon="refresh">
            {ar ? "تحديث" : "Recalculer"}
          </Button>
        </div>
      </Card>

      {/* === HOW TO IRRIGATE === */}
      <HowToIrrigate
        ar={ar}
        locale={locale}
        system={system}
        water={water}
        netWater={netWater}
        drip={drip}
        weather={weather}
        plot={plot}
      />

      {/* === AI RECOMMENDATION (Gemini) === */}
      <AiRecommendationCard
        ar={ar}
        loading={aiLoading}
        text={aiText}
        error={aiError}
      />

      {/* === PLOT CONFIG SUMMARY === */}
      {plot && (
        <PlotConfigCard
          ar={ar}
          plot={plot}
          system={system}
          efficiency={efficiency}
          harvest={harvest}
          locale={locale}
        />
      )}

      {/* === WATER SAVINGS === */}
      {savings && Object.keys(savings).length > 0 && (
        <WaterSavingsCard savings={savings} system={system} ar={ar} />
      )}

      {/* === DRIP SYSTEM === */}
      {system === "drip" && (drip.duration_hours || drip.liters_per_emitter) && (
        <DripDetailsCard drip={drip} ar={ar} />
      )}

      {/* === 7-DAY FORECAST === */}
      {result.forecast && result.forecast.length > 0 && (
        <ForecastChart forecast={result.forecast} ar={ar} />
      )}

      {/* === ADVANCED === */}
      <Card padding="none" className="overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="w-full px-5 py-4 flex items-center justify-between text-left rtl:text-right hover:bg-[var(--color-surface-muted)] transition-colors"
        >
          <span className="text-[15px] font-medium text-[var(--color-text-strong)]">
            {ar ? "تفاصيل علمية" : "Détails techniques"}
          </span>
          <Icon
            name={showAdvanced ? "chevronDown" : "chevronRight"}
            className={cn("h-4 w-4 text-[var(--color-text-muted)] transition-transform rtl-flip", showAdvanced && "rotate-180 rtl:rotate-180")}
          />
        </button>
        {showAdvanced && (
          <div className="px-5 pb-5 border-t border-[var(--color-border-subtle)]">
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat size="sm" value={result.eto_value?.toFixed?.(1) ?? "—"} unit="mm/j" label="ETo" />
              <Stat size="sm" value={result.etc_value?.toFixed?.(1) ?? "—"} unit="mm/j" label="ETc" />
              <Stat size="sm" value={efficiency ? `${efficiency}%` : "—"} label={ar ? "كفاءة الري" : "Efficacité"} />
              <Stat size="sm" value={result.growth_stage || "—"} label={ar ? "المرحلة" : "Stade"} />
            </div>
            <p className="mt-4 text-xs text-[var(--color-text-muted)] leading-relaxed">
              {ar
                ? "محسوب وفق منهجية FAO-56 المرجعية باستخدام بيانات الطقس من Open-Meteo (ECMWF/DWD، دقة 11 كم). ETo: التبخر-النتح المرجعي. ETc: حاجة المحصول من الماء (ETo × Kc حسب مرحلة النمو)."
                : "Calculé selon la méthode FAO-56, avec les données météo d'Open-Meteo (ECMWF/DWD, 11 km). ETo : évapotranspiration de référence. ETc : besoin en eau du couvert (ETo × Kc selon le stade)."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

/* =========================================================================== */

function HowToIrrigate({ ar, locale, system, water, netWater, drip, weather, plot }) {
  const systemLabel = SYSTEM_LABEL[system]?.[ar ? "ar" : "fr"] || system;

  // Heuristic time-of-day: hot midday → water early morning. Cool day → flexible.
  const tempMax = Number(weather.temperature_max || 0);
  const isHot = tempMax >= 30;
  const bestTime = isHot
    ? (ar ? "قبل شروق الشمس (05:00–07:00) أو بعد غروبها" : "Avant le lever du soleil (05:00–07:00) ou après le coucher")
    : (ar ? "في الصباح الباكر (05:00–09:00)" : "Tôt le matin (05:00–09:00)");

  // Frequency by net water need
  const freq = netWater >= 6
    ? (ar ? "كل يوم" : "Tous les jours")
    : netWater >= 3
      ? (ar ? "كل يومين" : "Un jour sur deux")
      : netWater > 0
        ? (ar ? "مرتين في الأسبوع" : "2 fois par semaine")
        : (ar ? "لا حاجة اليوم" : "Pas besoin aujourd'hui");

  // ---- Duration ----
  // Always produce a string. Use precise data when available, sensible
  // defaults otherwise. Tag with `approx: true` when we had to guess.
  const dur = computeDuration({ system, water, drip, ar });

  // ---- Volume ----
  // Show liters when we know the surface; otherwise show a per-100m² hint.
  const totalL = plot?.landSize ? Math.round(water * Number(plot.landSize)) : null;
  const litersPer100 = Math.round(water * 100); // 1 mm × 100 m² = 100 L
  const fmt = (n) => n.toLocaleString(ar ? "ar-MA" : "fr-FR");
  const volumeText = totalL != null
    ? (ar ? `${water} مم (≈ ${fmt(totalL)} لتر إجمالاً)` : `${water} mm (≈ ${fmt(totalL)} L au total)`)
    : (ar ? `${water} مم (≈ ${fmt(litersPer100)} لتر لكل 100 م²)` : `${water} mm (≈ ${fmt(litersPer100)} L pour 100 m²)`);

  // Step 2 string — never has "—"
  const step2 = ar
    ? `طبّق ${volumeText}، خلال ${dur.label}.`
    : `Apportez ${volumeText}, en ${dur.label}.`;

  // Missing data → friendly nudge to complete the plot
  const missingArea = !plot?.landSize;
  const missingDrip = system === "drip" && !plot?.emitterRate;
  const hasGaps = Boolean(plot) && (missingArea || missingDrip);

  if (water <= 0) {
    return (
      <Card padding="md" surface="leaf">
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[var(--color-primary-600)] text-white shrink-0">
            <Icon name="check" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
              {ar ? "لا حاجة للري اليوم" : "Pas d'arrosage nécessaire aujourd'hui"}
            </h3>
            <p className="text-sm text-[var(--color-text)] mt-1 leading-relaxed">
              {ar
                ? "الطقس والمطر يغطيان حاجة المحصول. وفّر الماء واتركه يرتاح."
                : "La météo et la pluie couvrent les besoins. Laissez la parcelle se reposer."}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-center gap-2 mb-4">
        <span className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-[var(--color-accent-100)] text-[var(--color-accent-700)]">
          <Icon name="droplet" className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
            {ar ? "كيف تسقي اليوم" : "Comment arroser aujourd'hui"}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {ar ? `بنظام ${systemLabel}` : `Avec votre système ${systemLabel.toLowerCase()}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <HowToTile
          icon="clock"
          label={ar ? "أفضل وقت" : "Meilleur moment"}
          value={bestTime}
          highlight
        />
        <HowToTile
          icon="refresh"
          label={ar ? "التكرار" : "Fréquence"}
          value={freq}
        />
        <HowToTile
          icon="settings"
          label={ar ? "المدة" : "Durée"}
          value={dur.label}
          hint={dur.hint}
          approx={dur.approx}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 text-sm text-[var(--color-text)] leading-relaxed">
        <Step n="1" text={
          ar
            ? `جهّز ${system === "drip" ? "خراطيم التنقيط" : system === "sprinkler" ? "الرشاشات" : "قنوات الري"} وتأكد من نظافتها.`
            : `Préparez ${system === "drip" ? "les goutteurs" : system === "sprinkler" ? "les asperseurs" : "les canaux"} et vérifiez qu'ils sont propres.`
        } />
        <Step n="2" text={step2} />
        <Step n="3" text={
          ar
            ? "افحص رطوبة التربة على عمق 10 سم بعد ساعة. إذا كانت جافة، أضف القليل."
            : "Vérifiez l'humidité du sol à 10 cm une heure après. Si sec en surface, complétez."
        } />
        {isHot && (
          <Step n="!" warn text={
            ar
              ? "تجنب الري في عز الحر (11h–16h): تتبخر معظم المياه ولا تصل للجذور."
              : "Évitez d'arroser en pleine chaleur (11h–16h) : l'eau s'évapore avant d'atteindre les racines."
          } />
        )}
      </div>

      {hasGaps && (
        <div className="mt-4 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)] p-3.5 flex items-start gap-3">
          <Icon name="info" className="h-4 w-4 text-[var(--color-accent-600)] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="text-[var(--color-text)] leading-relaxed">
              {ar
                ? `لحساب دقيق بالليتر${missingDrip ? " ومدة التنقيط الفعلية" : ""}، أضف`
                : `Pour un calcul exact en litres${missingDrip ? " et une durée de goutte-à-goutte précise" : ""}, renseignez`}{" "}
              <span className="font-medium text-[var(--color-text-strong)]">
                {missingArea && (ar ? "مساحة قطعتك" : "la surface de votre parcelle")}
                {missingArea && missingDrip && (ar ? " و" : " et ")}
                {missingDrip && (ar ? "تدفق المنقّط" : "le débit de vos goutteurs")}
              </span>.
            </p>
            <Link
              href={`/${locale}/onboarding?add=1`}
              className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-700)] hover:underline"
            >
              {ar ? "إكمال الإعدادات" : "Compléter ma parcelle"}
              <Icon name="arrowRight" className="h-3.5 w-3.5 rtl-flip" />
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * computeDuration — always returns { label, hint?, approx? }.
 *   - Drip with full backend data: precise hours/minutes.
 *   - Drip without data: typical band (≈ 1–2 h) marked as estimate.
 *   - Sprinkler: derived from mm and a typical 6 mm/h application rate.
 *   - Surface: convention (1–2 h).
 */
function computeDuration({ system, water, drip, ar }) {
  if (system === "drip") {
    const h = Number(drip?.duration_hours || 0);
    if (h > 0) {
      const label =
        h < 1 ? `${Math.round(h * 60)} min`
        : h < 2 ? `${h.toFixed(1)} h`
        : `${Math.round(h)} h`;
      return { label, hint: ar ? "حسب تدفق المنقّط" : "selon votre débit" };
    }
    // Fallback: typical drip session for the daily dose
    return {
      label: water >= 6 ? (ar ? "1 إلى 2 ساعة" : "1 à 2 h") : (ar ? "30 إلى 60 دقيقة" : "30 à 60 min"),
      hint: ar ? "تقدير افتراضي" : "estimation par défaut",
      approx: true,
    };
  }

  if (system === "sprinkler") {
    // Most field sprinklers deliver ~6 mm/h; show as minutes/hours.
    const mins = Math.max(15, Math.round((water / 6) * 60));
    const label = mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} h`;
    return {
      label,
      hint: ar ? "بمعدل ~6 مم/س" : "à ~6 mm/h",
      approx: true,
    };
  }

  // Surface (gravity / flood)
  return {
    label: ar ? "1 إلى 2 ساعة" : "1 à 2 h",
    hint: ar ? "حسب الحقل" : "selon la parcelle",
    approx: true,
  };
}

function HowToTile({ icon, label, value, hint, approx, highlight }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5",
        highlight
          ? "bg-[var(--color-accent-100)]/40 border-[var(--color-accent-200)]"
          : "bg-[var(--color-surface-sunken)] border-[var(--color-border)]"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[var(--color-text-muted)] font-medium">
        <Icon name={icon} className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1.5 text-[15px] font-semibold text-[var(--color-text-strong)] leading-tight">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[11px] text-[var(--color-text-muted)] leading-snug">
          {approx ? "≈ " : ""}{hint}
        </p>
      )}
    </div>
  );
}

function Step({ n, text, warn }) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "shrink-0 h-6 w-6 rounded-full inline-flex items-center justify-center text-xs font-bold num",
          warn
            ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)]"
            : "bg-[var(--color-primary-100)] text-[var(--color-primary-800)]"
        )}
      >
        {n}
      </span>
      <p className="pt-0.5">{text}</p>
    </div>
  );
}

/* =========================================================================== */

function AiRecommendationCard({ ar, loading, text, error }) {
  if (error === "not_configured" && !text) return null; // Gemini disabled — hide silently

  return (
    <Card padding="md" surface="sky" className="relative overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-[var(--color-accent-500)] text-white">
          <Icon name="sprout" className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
            {ar ? "نصيحة الاستشاري الذكي" : "Conseil personnalisé"}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {ar ? "مولّد لك اليوم بناءً على بياناتك" : "Généré pour vous aujourd'hui, à partir de vos données"}
          </p>
        </div>
        <Badge variant="accent" size="sm">AI</Badge>
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={14} width="80%" />
        </div>
      )}

      {!loading && text && (
        <p className="text-[15px] text-[var(--color-text)] leading-relaxed whitespace-pre-line">
          {text}
        </p>
      )}

      {!loading && !text && error && error !== "not_configured" && (
        <p className="text-sm text-[var(--color-text-muted)] italic">
          {ar
            ? "تعذر توليد التوصية حالياً. أعد المحاولة بعد قليل."
            : "Le conseil personnalisé n'est pas disponible pour le moment. Réessayez bientôt."}
        </p>
      )}
    </Card>
  );
}

/* =========================================================================== */

function PlotConfigCard({ ar, plot, system, efficiency, harvest, locale }) {
  const sys = SYSTEM_LABEL[system];
  const harvestDate = harvest?.estimated_harvest_date;
  const daysLeft = harvest?.days_to_harvest;
  const harvestStatus = harvest?.harvest_status;

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
            {ar ? "إعدادات قطعتك" : "Configuration de votre parcelle"}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {ar ? "البيانات التي أدخلتها." : "Les informations que vous avez fournies."}
          </p>
        </div>
        <Button href={`/${locale}/onboarding?add=1`} variant="ghost" size="sm" leadingIcon="edit">
          {ar ? "تعديل" : "Modifier"}
        </Button>
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-sm">
        <Field label={ar ? "اسم القطعة" : "Nom"} value={plot.name} />
        <Field label={ar ? "المحصول" : "Culture"} value={plot.crop} />
        <Field label={ar ? "المنطقة" : "Région"} value={plot.region} />
        <Field label={ar ? "نوع التربة" : "Sol"} value={plot.soil} />
        <Field
          label={ar ? "نظام الري" : "Système d'irrigation"}
          value={sys ? `${sys[ar ? "ar" : "fr"]} · ${sys.efficiency}` : system}
        />
        <Field
          label={ar ? "المساحة" : "Surface"}
          value={plot.landSize ? `${Number(plot.landSize).toLocaleString(ar ? "ar-MA" : "fr-FR")} m²` : (ar ? "غير محدد" : "Non renseigné")}
          missing={!plot.landSize}
        />
        {system === "drip" && (
          <Field
            label={ar ? "تدفق المنقّط" : "Débit goutteur"}
            value={plot.emitterRate ? `${plot.emitterRate} L/h` : (ar ? "غير محدد" : "Non renseigné")}
            missing={!plot.emitterRate}
          />
        )}
        <Field
          label={ar ? "تاريخ الزرع" : "Date de plantation"}
          value={
            plot.plantingDate
              ? new Date(plot.plantingDate).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short", year: "numeric" })
              : (ar ? "غير محدد" : "Non renseigné")
          }
          missing={!plot.plantingDate}
        />
        {harvestDate && (
          <Field
            label={ar ? "حصاد متوقع" : "Récolte estimée"}
            value={
              <>
                {new Date(harvestDate).toLocaleDateString(ar ? "ar-MA" : "fr-FR", { day: "numeric", month: "short" })}
                {daysLeft != null && daysLeft >= 0 && (
                  <span className="ms-1 text-[var(--color-text-muted)]">
                    ({ar ? `${daysLeft} يوم` : `dans ${daysLeft} j`})
                  </span>
                )}
                {harvestStatus === "soon" && <Badge variant="warning" size="sm" className="ms-2">{ar ? "قريباً" : "Bientôt"}</Badge>}
              </>
            }
          />
        )}
      </dl>

      {(!plot.landSize || (system === "drip" && !plot.emitterRate)) && (
        <Banner tone="info" className="mt-4">
          {ar
            ? "أضف المساحة وتدفق المنقّط لتحصل على حسابات أدق (لتر، مدة الري)."
            : "Renseignez la surface et le débit pour obtenir des calculs plus précis (litres, durée)."}
        </Banner>
      )}
    </Card>
  );
}

function Field({ label, value, missing }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider font-medium text-[var(--color-text-muted)]">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-[15px]",
          missing ? "text-[var(--color-text-subtle)] italic" : "text-[var(--color-text-strong)] font-medium"
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

/* =========================================================================== */

function WaterSavingsCard({ savings, system, ar }) {
  // Typical shape: { drip_liters, sprinkler_liters, surface_liters, savings_liters }
  const SYS = [
    { key: "drip",      label: ar ? "بالتنقيط" : "Goutte-à-goutte" },
    { key: "sprinkler", label: ar ? "بالرش" : "Aspersion" },
    { key: "surface",   label: ar ? "بالغمر" : "Gravitaire" },
  ];
  const values = SYS.map((s) => ({
    ...s,
    liters: Number(savings[`${s.key}_liters`] || 0),
    active: s.key === system,
  })).filter((s) => s.liters > 0);

  if (values.length === 0) return null;

  const max = Math.max(...values.map((v) => v.liters));
  const savedL = Number(savings.savings_liters || 0);

  return (
    <Card padding="md" surface="leaf">
      <div className="flex items-start gap-3">
        <span className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-[var(--color-primary-600)] text-white shrink-0">
          <Icon name="trendingDown" className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
            {ar ? "كم من الماء توفّر اليوم" : "Économie d'eau aujourd'hui"}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {ar ? "مقارنة بين الأنظمة الثلاثة لنفس الحاجة." : "Comparaison des trois systèmes pour la même demande."}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {values.map((v) => {
          const pct = max > 0 ? (v.liters / max) * 100 : 0;
          return (
            <div key={v.key}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className={cn(
                  "font-medium",
                  v.active ? "text-[var(--color-primary-800)]" : "text-[var(--color-text)]"
                )}>
                  {v.label}
                  {v.active && <span className="ms-1.5 text-xs">({ar ? "نظامك" : "votre système"})</span>}
                </span>
                <span className="text-sm font-semibold text-[var(--color-text-strong)] num">
                  {v.liters.toLocaleString(ar ? "ar-MA" : "fr-FR")} L
                </span>
              </div>
              <Progress
                value={pct}
                tone={v.active ? "primary" : v.key === "drip" ? "success" : v.key === "sprinkler" ? "warning" : "danger"}
                size="sm"
              />
            </div>
          );
        })}
      </div>

      {savedL > 0 && (
        <p className="mt-4 text-sm text-[var(--color-text)] bg-[var(--color-surface)] rounded-lg p-3 border border-[var(--color-border)]">
          <Icon name="checkCircle" className="h-4 w-4 text-[var(--color-success)] inline mb-0.5 me-1" />
          {ar
            ? <>وفّرت <strong className="text-[var(--color-primary-800)] num">{savedL.toLocaleString("ar-MA")} لتر</strong> اليوم مقارنة بأسوأ نظام.</>
            : <>Vous économisez <strong className="text-[var(--color-primary-800)] num">{savedL.toLocaleString("fr-FR")} L</strong> aujourd'hui par rapport au système le moins efficace.</>
          }
        </p>
      )}
    </Card>
  );
}

/* =========================================================================== */

function DripDetailsCard({ drip, ar }) {
  return (
    <Card padding="md">
      <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)] flex items-center gap-2 mb-4">
        <Icon name="droplet" className="h-4 w-4 text-[var(--color-accent-600)]" />
        {ar ? "تشغيل التنقيط" : "Programmation du goutte-à-goutte"}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {drip.duration_hours != null && (
          <Stat
            size="sm"
            value={drip.duration_hours < 1 ? Math.round(drip.duration_hours * 60) : drip.duration_hours.toFixed(1)}
            unit={drip.duration_hours < 1 ? "min" : "h"}
            label={ar ? "المدة" : "Durée"}
          />
        )}
        {drip.liters_per_emitter != null && (
          <Stat
            size="sm"
            value={Math.round(drip.liters_per_emitter)}
            unit="L"
            label={ar ? "لكل منقّط" : "Par goutteur"}
          />
        )}
        {drip.pump_ok != null && (
          <Stat
            size="sm"
            value={drip.pump_ok ? (ar ? "كافية" : "Suffisante") : (ar ? "غير كافية" : "Insuffisante")}
            label={ar ? "حالة المضخة" : "Pompe"}
          />
        )}
      </div>
      {drip.pump_ok === false && (
        <Banner tone="warning" className="mt-4" title={ar ? "المضخة قد لا تكفي" : "Débit pompe limité"}>
          {ar
            ? "إن استمر الوضع، قسّم الري على دفعتين أو راجع تدفق المنقّطات."
            : "Étalez l'arrosage sur deux passes, ou vérifiez le débit des goutteurs."}
        </Banner>
      )}
    </Card>
  );
}

/* =========================================================================== */

function ForecastChart({ forecast, ar }) {
  // The API returns items shaped like: { date, temp_max, precipitation, eto }
  // We approximate "water need" per day with ETc-ish value (ETo). Real Kc is
  // already factored into today's number; for the chart we use ETo as a proxy.
  const data = forecast.map((d) => ({
    date: d.date,
    irrigation_mm: Math.max(0, Number(d.eto || 0) - Math.max(0, Number(d.precipitation || 0) * 0.8)),
    precipitation: Number(d.precipitation || 0),
  }));

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
          {ar ? "توقعات الأسبوع" : "Prévisions 7 jours"}
        </h3>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--color-primary-500)]" />
            {ar ? "ري" : "Arrosage"}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--color-accent-500)]" />
            {ar ? "مطر" : "Pluie"}
          </span>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="var(--color-text-muted)"
              fontSize={11}
              tickFormatter={(d) => {
                try {
                  return new Intl.DateTimeFormat(ar ? "ar-MA" : "fr-FR", { weekday: "short" }).format(new Date(d));
                } catch { return d; }
              }}
            />
            <YAxis stroke="var(--color-text-muted)" fontSize={11} unit=" mm" />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelFormatter={(d) => {
                try {
                  return new Intl.DateTimeFormat(ar ? "ar-MA" : "fr-FR", { weekday: "long", day: "numeric", month: "short" }).format(new Date(d));
                } catch { return d; }
              }}
            />
            <Bar dataKey="irrigation_mm" fill="var(--color-primary-500)" radius={[6, 6, 0, 0]} name={ar ? "ري" : "Arrosage"} unit=" mm" />
            <Line type="monotone" dataKey="precipitation" stroke="var(--color-accent-500)" strokeWidth={2.5} dot={{ r: 3 }} name={ar ? "مطر" : "Pluie"} unit=" mm" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* =========================================================================== */

function AlertChip({ level, ar }) {
  if (level === "critical") return <Badge variant="danger" icon="alertTriangle">{ar ? "حرج" : "Critique"}</Badge>;
  if (level === "warning")  return <Badge variant="warning" icon="alertCircle">{ar ? "تنبيه" : "Attention"}</Badge>;
  return <Badge variant="success" icon="checkCircle">{ar ? "عادي" : "Optimal"}</Badge>;
}
