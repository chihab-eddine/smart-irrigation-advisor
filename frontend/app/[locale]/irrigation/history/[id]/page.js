"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import Icon from "@/components/Icon";
import Spinner from "@/components/Spinner";
import { createAPIClient } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const ALERT_STYLES = {
  critical: "bg-red-50 text-red-700 border-red-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  normal: "bg-brand-50 text-brand-700 border-brand-200",
};

const ALERT_ICONS = {
  critical: "alertTriangle",
  warning: "alertCircle",
  normal: "checkCircle",
};

const TECH_TERMS = {
  ETo: {
    fr: "Évapotranspiration de référence : estimation de l'eau perdue par évaporation et transpiration dans des conditions standard.",
    ar: "التبخر-النتح المرجعي: تقدير كمية الماء المفقودة بالتبخر ونتح النبات في ظروف معيارية.",
  },
  ETc: {
    fr: "Évapotranspiration de la culture : besoin en eau estimé pour la culture sélectionnée.",
    ar: "تبخر-نتح المحصول: الحاجة التقديرية للماء للمحصول المختار.",
  },
};

export default function IrrigationCalculationPage() {
  const locale = useLocale();
  const ar = locale === "ar";
  const params = useParams();
  const supabase = createClient();

  const [calculation, setCalculation] = useState(null);
  const [aiAdvice, setAiAdvice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setLoading(false);
        return;
      }

      try {
        const client = createAPIClient(session.access_token);
        const data = await client.getIrrigationCalculation(params.id, locale);
        if (cancelled) return;
        setCalculation(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load calculation");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [supabase, params.id, locale]);

  const loadDailyAdvice = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const client = createAPIClient(session?.access_token);
      const data = await client.getIrrigationAIRecommendation(params.id, locale);
      setAiAdvice(data);
    } catch (err) {
      setAiError(err.message || "Failed to load AI recommendation");
    } finally {
      setAiLoading(false);
    }
  };

  const harvest = calculation?.harvest_estimate || {};
  const current = calculation?.current_update || null;
  const weather = calculation?.weather_data || {};
  const alertLevel = calculation?.alert_level || "normal";

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">

      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/irrigation/history`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            >
              <Icon name="arrowLeft" className="h-4 w-4 rtl-flip" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                {ar ? "تفاصيل تحليل الري" : "Détail du calcul d'irrigation"}
              </h1>
              <p className="text-sm text-gray-500">
                {ar
                  ? "التوصية المحفوظة، تقدير الحصاد، والنصيحة اليومية."
                  : "Recommandation sauvegardée, estimation de récolte et conseil du jour."}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner className="h-8 w-8 text-brand-600" />
            </div>
          ) : error ? (
            <Alert type="error" text={error} />
          ) : calculation ? (
            <>
              <section className="rounded-lg border border-gray-200 bg-white p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    {alertLevel !== "critical" && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${
                          ALERT_STYLES[alertLevel] || ALERT_STYLES.normal
                        }`}
                      >
                        <Icon name={ALERT_ICONS[alertLevel] || "checkCircle"} className="h-3.5 w-3.5" />
                        {alertLevel === "warning"
                          ? ar ? "تحذير" : "Attention"
                          : ar ? "عادي" : "Normal"}
                      </span>
                    )}
                    <h2 className="mt-3 text-xl font-semibold text-gray-900">
                      {calculation.crop_name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {calculation.region_name} · {calculation.soil_type_name}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(calculation.created_at).toLocaleString(locale)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Metric label={ar ? "ماء/يوم" : "Eau/jour"} value={`${calculation.recommended_water_mm} mm`} />
                    <Metric label={<TechnicalTerm term="ETo" locale={locale} />} value={`${calculation.eto_value} mm`} />
                    <Metric label={<TechnicalTerm term="ETc" locale={locale} />} value={`${calculation.etc_value} mm`} />
                    <Metric label={ar ? "مرحلة" : "Stade"} value={calculation.growth_stage || "—"} />
                  </div>
                </div>

                <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                  {calculation.recommendation}
                </div>
              </section>

              {/* ----- Persisted field geometry + irrigation system ----- */}
              <SystemSummary calculation={calculation} locale={locale} ar={ar} />

              <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {current && (
                  <div className="rounded-lg border border-brand-200 bg-brand-50 p-6 lg:col-span-2">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-brand-950">
                          {ar ? "الحساب المحدّث لليوم" : "Calcul actualisé aujourd'hui"}
                        </h2>
                        <p className="mt-1 text-sm text-brand-800">
                          {ar
                            ? "محسوب من تاريخ الزراعة نفسه، لكن حسب طقس اليوم."
                            : "Calculé avec la même date de plantation, mais selon la météo du jour."}
                        </p>
                      </div>
                      <span className="text-xs font-medium text-brand-800">
                        {new Date(current.date).toLocaleDateString(locale)}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <Metric label={ar ? "ماء/يوم" : "Eau/jour"} value={`${current.recommended_water_mm} mm`} />
                      <Metric label={<TechnicalTerm term="ETo" locale={locale} />} value={`${current.eto_value} mm`} />
                      <Metric label={<TechnicalTerm term="ETc" locale={locale} />} value={`${current.etc_value} mm`} />
                      <Metric label={ar ? "مرحلة" : "Stade"} value={current.growth_stage || "—"} />
                    </div>
                    <div className="mt-4 rounded-md border border-brand-200 bg-white/70 p-4 text-sm leading-relaxed text-brand-950 whitespace-pre-line">
                      {current.recommendation}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="text-base font-semibold text-gray-900">
                    {ar ? "تقدير الحصاد" : "Estimation de récolte"}
                  </h2>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Metric
                      label={ar ? "تاريخ الزراعة" : "Plantation"}
                      value={calculation.planting_date ? new Date(calculation.planting_date).toLocaleDateString(locale) : "—"}
                    />
                    <Metric
                      label={ar ? "تاريخ الحصاد" : "Récolte estimée"}
                      value={harvest.estimated_harvest_date ? new Date(harvest.estimated_harvest_date).toLocaleDateString(locale) : "—"}
                    />
                    <Metric
                      label={ar ? "الأيام المتبقية" : "Jours restants"}
                      value={harvest.days_to_harvest == null ? "—" : harvest.days_to_harvest}
                    />
                    <Metric
                      label={ar ? "الحالة" : "Statut"}
                      value={
                        harvest.harvest_status === "soon"
                          ? ar ? "قريب" : "Bientôt"
                          : harvest.harvest_status === "past"
                          ? ar ? "فات الموعد" : "Dépassé"
                          : harvest.harvest_status === "planned"
                          ? ar ? "مخطط" : "Planifié"
                          : "—"
                      }
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <h2 className="text-base font-semibold text-gray-900">
                    {ar ? "الطقس المحفوظ وقت التحليل" : "Météo sauvegardée au calcul"}
                  </h2>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Metric label={ar ? "الحرارة" : "Température"} value={`${weather.temperature ?? "—"}°C`} />
                    <Metric label={ar ? "الرطوبة" : "Humidité"} value={`${weather.humidity ?? "—"}%`} />
                    <Metric label={ar ? "الرياح" : "Vent"} value={`${weather.wind_speed ?? "—"} km/h`} />
                    <Metric label={ar ? "أمطار" : "Pluie"} value={`${weather.precipitation ?? "—"} mm`} />
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-gray-200 bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      {ar ? "التوصية اليومية" : "Recommandation du jour"}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {ar
                        ? "تُحفظ توصية واحدة يوميًا لهذا التحليل حسب الطقس الحالي وتاريخ الزراعة."
                        : "Une recommandation est sauvegardée chaque jour pour ce calcul selon la météo actuelle et la date de plantation."}
                    </p>
                  </div>
                  {!aiAdvice && (
                    <button
                      type="button"
                      onClick={loadDailyAdvice}
                      disabled={aiLoading}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {aiLoading ? <Spinner className="h-4 w-4 text-white" /> : <Icon name="sprout" className="h-4 w-4" />}
                      {ar ? "عرض توصية اليوم" : "Voir la recommandation du jour"}
                    </button>
                  )}
                </div>

                {aiError && <div className="mt-4"><Alert type="error" text={aiError} /></div>}

                {aiAdvice && (
                  <div className="mt-5 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                        <Icon name="calendar" className="h-3.5 w-3.5" />
                        {new Date(aiAdvice.recommendation_date).toLocaleDateString(locale)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                        <Icon name="checkCircle" className="h-3.5 w-3.5" />
                        {aiAdvice.cached
                          ? ar ? "محفوظة سابقًا" : "Déjà sauvegardée"
                          : ar ? "تم حفظها الآن" : "Sauvegardée maintenant"}
                      </span>
                    </div>
                    <div className="rounded-md border border-brand-100 bg-brand-50 p-4 text-sm leading-relaxed text-brand-950 whitespace-pre-line">
                      {aiAdvice.text}
                    </div>
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900 tabular-nums">{value}</div>
    </div>
  );
}

const METHOD_LABELS_FR = {
  drip: "Goutte-à-goutte",
  sprinkler: "Aspersion",
  surface: "Surface / Gravitaire",
};
const METHOD_LABELS_AR = {
  drip: "بالتنقيط",
  sprinkler: "بالرش",
  surface: "سطحي / غمر",
};

function SystemSummary({ calculation, locale, ar }) {
  // Render nothing if this prediction was saved before we tracked land/system data.
  if (!calculation?.total_water_liters || !calculation?.land_size_m2) return null;

  const labels = ar ? METHOD_LABELS_AR : METHOD_LABELS_FR;
  const methodLabel = labels[calculation.irrigation_method] || calculation.irrigation_method;
  const savings = calculation.water_savings || {};
  const drip = calculation.drip_info || {};

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        {ar ? "ملخص الري لقطعتك" : "Bilan pour votre parcelle"}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-md bg-gray-50 border border-gray-200">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            {ar ? "المساحة" : "Surface"}
          </div>
          <div className="mt-1 text-xl font-semibold text-gray-900 tabular-nums">
            {Number(calculation.land_size_m2).toLocaleString(locale)} m²
          </div>
        </div>
        <div className="p-4 rounded-md bg-gray-50 border border-gray-200">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
            {ar ? "نظام الري" : "Méthode"}
          </div>
          <div className="mt-1 text-base font-semibold text-gray-900">{methodLabel}</div>
          {calculation.irrigation_efficiency > 0 && (
            <div className="mt-1 text-[11px] text-gray-500">
              {ar ? "كفاءة:" : "Efficacité :"}{" "}
              <span className="font-medium text-gray-700">
                {(calculation.irrigation_efficiency * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>
        <div className="p-4 rounded-md bg-brand-50 border border-brand-200">
          <div className="text-[11px] font-medium uppercase tracking-wide text-brand-700">
            {ar ? "إجمالي الماء المطلوب" : "Eau totale (calcul du jour)"}
          </div>
          <div className="mt-1 text-2xl font-semibold text-brand-900 tabular-nums">
            {Number(calculation.total_water_liters).toLocaleString(locale)} L
          </div>
          <div className="mt-1 text-[11px] text-brand-800">
            ≈ {(Number(calculation.total_water_liters) / 1000).toFixed(2)} m³
            {calculation.gross_water_mm
              ? ` · ${ar ? "إجمالي" : "à appliquer"}: ${calculation.gross_water_mm} mm`
              : ""}
          </div>
        </div>
      </div>

      {/* Method comparison */}
      {savings.per_method_liters && (
        <div className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
            {ar ? "مقارنة استهلاك الماء بين الأنظمة" : "Comparaison de consommation par méthode"}
          </div>
          <div className="space-y-2">
            {Object.entries(savings.per_method_liters).map(([m, liters]) => {
              const worst = savings.worst_method_liters || liters;
              const pct = worst > 0 ? (liters / worst) * 100 : 0;
              const isChosen = m === calculation.irrigation_method;
              return (
                <div
                  key={m}
                  className={`flex items-center gap-3 p-2.5 rounded-md border ${
                    isChosen ? "bg-brand-50 border-brand-200" : "bg-white border-gray-200"
                  }`}
                >
                  <div className="w-32 text-sm font-medium text-gray-900">{labels[m] || m}</div>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isChosen ? "bg-brand-600" : "bg-gray-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-28 text-right rtl:text-left text-sm tabular-nums text-gray-700">
                    {Number(liters).toLocaleString(locale)} L
                  </div>
                </div>
              );
            })}
          </div>
          {savings.saved_vs_worst_liters > 0 && (
            <p className="mt-3 text-sm text-brand-800 inline-flex items-center gap-1.5">
              <Icon name="droplet" className="h-4 w-4 text-brand-600" />
              {ar
                ? `توفير ${Number(savings.saved_vs_worst_liters).toLocaleString(locale)} لتر (${savings.saved_vs_worst_pct}%) مقارنة بالسطحي.`
                : `Économie de ${Number(savings.saved_vs_worst_liters).toLocaleString(locale)} L (${savings.saved_vs_worst_pct}%) par rapport au gravitaire.`}
            </p>
          )}
        </div>
      )}

      {/* Drip schedule */}
      {drip.duration_hours > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-100">
          <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">
            {ar ? "جدولة التنقيط" : "Planification du goutte-à-goutte"}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label={ar ? "مدة التشغيل" : "Durée d'arrosage"} value={`${drip.duration_hours} h`} />
            <Metric label={ar ? "لكل قطّارة" : "Par goutteur"} value={`${drip.liters_per_emitter} L`} />
            <Metric label={ar ? "التدفق المطلوب" : "Débit requis"} value={`${drip.total_flow_needed_lph} L/h`} />
            {drip.pump_ok !== null && drip.pump_ok !== undefined && (
              <Metric
                label={ar ? "المضخة" : "Pompe"}
                value={drip.pump_ok ? (ar ? "كافية" : "Suffisante") : (ar ? "غير كافية" : "Insuffisante")}
              />
            )}
          </div>
          {drip.pump_ok === false && (
            <p className="mt-3 text-xs text-amber-800 inline-flex items-start gap-1.5">
              <Icon name="alertCircle" className="h-3.5 w-3.5 mt-0.5" />
              {ar
                ? `تدفق المضخة (${drip.pump_flow_rate_lph} ل/س) أقل من المطلوب (${drip.total_flow_needed_lph} ل/س).`
                : `Le débit de la pompe (${drip.pump_flow_rate_lph} L/h) est inférieur au débit requis (${drip.total_flow_needed_lph} L/h).`}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function TechnicalTerm({ term, locale }) {
  const explanation = TECH_TERMS[term]?.[locale] || TECH_TERMS[term]?.fr || "";
  return (
    <span className="group relative inline-flex items-center gap-1">
      <abbr title={explanation} className="cursor-help no-underline group-hover:underline">
        {term}
      </abbr>
      <Icon name="info" className="h-3 w-3 text-gray-400" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-64 -translate-x-1/2 rounded-md border border-gray-200 bg-gray-900 px-3 py-2 text-xs normal-case leading-relaxed text-white shadow-lg group-hover:block">
        {explanation}
      </span>
    </span>
  );
}

function Alert({ text }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <Icon name="alertCircle" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
