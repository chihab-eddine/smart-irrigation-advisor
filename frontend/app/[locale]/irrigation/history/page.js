"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import Spinner from "@/components/Spinner";
import { createAPIClient } from "@/lib/api";
import Link from "next/link";

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

export default function IrrigationHistoryPage() {
  const t = useTranslations("irrigationPage");
  const locale = useLocale();
  const ar = locale === "ar";
  const supabase = createClient();

  const [history, setHistory] = useState([]);
  const [activeGroup, setActiveGroup] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!activeSession) {
        setLoading(false);
        return;
      }

      try {
        const client = createAPIClient(activeSession.access_token);
        const res = await client.getIrrigationHistory(200);
        if (cancelled) return;
        if (res && res.data) setHistory(res.data);
        else setError("Failed to fetch history");
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to fetch history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [supabase]);

  const nameKey = locale === "ar" ? "name_ar" : "name_fr";

  const groupedHistory = useMemo(() => {
    const groups = new Map();

    for (const item of history) {
      const cropName = item.crops ? item.crops[nameKey] : "—";
      const regionName = item.moroccan_regions ? item.moroccan_regions[nameKey] : "—";
      const soilName = item.soil_types ? item.soil_types[nameKey] : "—";
      const planted = item.planting_date || "no-date";
      const key = `${item.crop_id || cropName}-${item.region_id || regionName}-${item.soil_type_id || soilName}-${planted}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          cropName,
          regionName,
          soilName,
          plantingDate: item.planting_date,
          items: [],
        });
      }
      groups.get(key).items.push(item);
    }

    return Array.from(groups.values())
      .map((group) => {
        const sorted = [...group.items].sort(
          (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
        );
        const latest = sorted[0];
        const avgWater = sorted.reduce((sum, item) => sum + (item.recommended_water_mm || 0), 0) / sorted.length;
        const alerts = sorted.filter((item) => item.alert_level === "warning" || item.alert_level === "critical").length;
        return {
          ...group,
          items: sorted,
          latest,
          avgWater,
          alerts,
        };
      })
      .sort((a, b) => new Date(b.latest?.created_at || 0) - new Date(a.latest?.created_at || 0));
  }, [history, nameKey]);

  const visibleGroups = activeGroup === "all"
    ? groupedHistory
    : groupedHistory.filter((group) => group.key === activeGroup);

  const totals = useMemo(() => {
    const avg = history.length
      ? history.reduce((sum, item) => sum + (item.recommended_water_mm || 0), 0) / history.length
      : 0;
    return {
      groups: groupedHistory.length,
      analyses: history.length,
      avg,
      alerts: history.filter((item) => item.alert_level === "warning" || item.alert_level === "critical").length,
    };
  }, [history, groupedHistory]);

  const alertBadge = (level) => {
    const cls = {
      critical: "bg-red-50 text-red-700 border-red-200",
      warning: "bg-amber-50 text-amber-800 border-amber-200",
      normal: "bg-brand-50 text-brand-700 border-brand-200",
    };
    return cls[level] || cls.normal;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/irrigation`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            >
              <Icon name="arrowLeft" className="h-4 w-4 rtl-flip" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                {t("historyTitle")}
              </h1>
              <p className="text-sm text-gray-500">
                {ar
                  ? "تابع تحاليل الري يومًا بعد يوم حسب المحصول المزروع"
                  : "Suivez vos analyses jour par jour, groupées par culture plantée"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner className="h-8 w-8 text-brand-600" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 p-4 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
              <Icon name="alertCircle" className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : history.length === 0 ? (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
              <span className="h-12 w-12 inline-flex items-center justify-center rounded-md bg-gray-100 text-gray-500">
                <Icon name="history" className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm text-gray-500 max-w-sm mx-auto">
                {locale === "ar"
                  ? "لا يوجد سجل. ابدأ بأول تحليل."
                  : "Aucun historique. Lancez votre premier calcul."}
              </p>
              <Link
                href={`/${locale}/irrigation`}
                className="mt-4 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              >
                <Icon name="droplet" className="h-4 w-4" />
                {t("analyzeButton")}
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: ar ? "مزروعات" : "Plantations", value: totals.groups, icon: "sprout" },
                  { label: ar ? "تحاليل محفوظة" : "Analyses enregistrées", value: totals.analyses, icon: "history" },
                  { label: ar ? "متوسط الماء" : "Eau moyenne", value: `${totals.avg.toFixed(1)} mm`, icon: "droplet" },
                  { label: ar ? "تنبيهات" : "Alertes", value: totals.alerts, icon: "alertTriangle" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-4">
                    <Icon name={item.icon} className="h-4 w-4 text-brand-600" />
                    <div className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">
                      {item.value}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">{item.label}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
                  {ar ? "تصفية حسب المزروع" : "Filtrer par plantation"}
                </label>
                <select
                  value={activeGroup}
                  onChange={(e) => setActiveGroup(e.target.value)}
                  className="block w-full md:max-w-md h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="all">
                    {ar ? "كل المزروعات" : "Toutes les plantations"}
                  </option>
                  {groupedHistory.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.cropName} · {group.regionName} ·{" "}
                      {group.plantingDate
                        ? new Date(group.plantingDate).toLocaleDateString(locale)
                        : ar ? "بدون تاريخ زراعة" : "sans date de plantation"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                {visibleGroups.map((group) => (
                  <section key={group.key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="p-5 border-b border-gray-200 bg-gray-50">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h2 className="text-base font-semibold text-gray-900">
                            {group.cropName}
                          </h2>
                          <p className="mt-1 text-sm text-gray-600">
                            {group.regionName} · {group.soilName}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {ar ? "تاريخ الزراعة:" : "Planté le:"}{" "}
                            {group.plantingDate
                              ? new Date(group.plantingDate).toLocaleDateString(locale)
                              : ar ? "غير محدد" : "non renseigné"}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center md:w-80">
                          <MiniStat label={ar ? "أيام" : "Jours"} value={group.items.length} />
                          <MiniStat label={ar ? "متوسط" : "Moyenne"} value={`${group.avgWater.toFixed(1)} mm`} />
                          <MiniStat label={ar ? "تنبيهات" : "Alertes"} value={group.alerts} />
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-white">
                          <tr>
                            <th className="px-5 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {ar ? "يوم التحليل" : "Jour d'analyse"}
                            </th>
                            <th className="px-5 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {ar ? "مرحلة" : "Stade"}
                            </th>
                            <th className="px-5 py-3 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                              <TechnicalTerm term="ETo" locale={locale} />
                            </th>
                            <th className="px-5 py-3 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                              <TechnicalTerm term="ETc" locale={locale} />
                            </th>
                            <th className="px-5 py-3 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {ar ? "ماء/يوم" : "Eau/jour"}
                            </th>
                            <th className="px-5 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {ar ? "تنبيه" : "Alerte"}
                            </th>
                            <th className="px-5 py-3 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                              {ar ? "فتح" : "Consulter"}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {group.items.map((item) => (
                            <tr key={item.id} className="table-row">
                              <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">
                                {new Date(item.created_at).toLocaleDateString(locale, {
                                  weekday: "short",
                                  day: "numeric",
                                  month: "short",
                                })}
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap text-sm capitalize text-gray-700">
                                {item.growth_stage || "—"}
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-700 text-right rtl:text-left tabular-nums">
                                {item.eto_value ?? "—"}
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-700 text-right rtl:text-left tabular-nums">
                                {item.etc_value ?? "—"}
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900 text-right rtl:text-left tabular-nums">
                                {item.recommended_water_mm} mm
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap">
                                {item.alert_level !== "critical" && (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${alertBadge(
                                      item.alert_level
                                    )}`}
                                  >
                                    {item.alert_level === "warning"
                                      ? t("alertWarning")
                                      : t("alertNormal")}
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 whitespace-nowrap text-right rtl:text-left">
                                <Link
                                  href={`/${locale}/irrigation/history/${item.id}`}
                                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                  <Icon name="externalLink" className="h-3.5 w-3.5" />
                                  {ar ? "تفاصيل" : "Détail"}
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <div className="text-sm font-semibold text-gray-900 tabular-nums">{value}</div>
      <div className="mt-0.5 text-[11px] text-gray-500">{label}</div>
    </div>
  );
}

function TechnicalTerm({ term, locale }) {
  const explanation = TECH_TERMS[term]?.[locale] || TECH_TERMS[term]?.fr || "";
  return (
    <span className="group relative inline-flex items-center justify-end gap-1">
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
