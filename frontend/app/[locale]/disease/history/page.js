"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import Spinner from "@/components/Spinner";
import { createAPIClient } from "@/lib/api";
import Link from "next/link";

export default function DiseaseHistoryPage() {
  const t = useTranslations("diseasePage");
  const locale = useLocale();
  const supabase = createClient();

  const [history, setHistory] = useState([]);
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
        const res = await client.getDiseaseHistory(100);
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

  const nameKey = locale === "ar" ? "disease_name_ar" : "disease_name_fr";
  const treatmentKey = locale === "ar" ? "treatment_ar" : "treatment_fr";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/disease`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            >
              <Icon name="arrowLeft" className="h-4 w-4 rtl-flip" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                {t("historyTitle")}
              </h1>
              <p className="text-sm text-gray-500">
                {locale === "ar"
                  ? "سجل تشخيصات أمراض النبات"
                  : "Historique de vos diagnostics de maladies"}
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
                <Icon name="image" className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm text-gray-500 max-w-sm mx-auto">
                {locale === "ar"
                  ? "لا يوجد سجل. حلل أول صورة لك."
                  : "Aucun diagnostic. Analysez votre première feuille."}
              </p>
              <Link
                href={`/${locale}/disease`}
                className="mt-4 inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
              >
                <Icon name="upload" className="h-4 w-4" />
                {t("analyzeButton")}
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {history.map((item) => (
                <Link
                  key={item.id}
                  href={`/${locale}/disease/history/${item.id}`}
                  className="bg-white rounded-lg border border-gray-200 p-4 flex gap-4 hover:border-gray-300 transition-colors"
                >
                  {item.image_url ? (
                    <div className="relative h-20 w-20 rounded-md overflow-hidden bg-gray-50 border border-gray-200 shrink-0">
                      <img src={item.image_url} alt="Leaf" className="object-cover w-full h-full" />
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-md bg-gray-50 border border-gray-200 shrink-0 inline-flex items-center justify-center text-gray-400">
                      <Icon name="image" className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {item[nameKey] || item.disease_key}
                      </h3>
                    </div>
                    {item.crop_type && (
                      <p className="text-xs text-gray-500 capitalize">{item.crop_type}</p>
                    )}
                    <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                      {item[treatmentKey]}
                    </p>
                    <p className="text-[11px] text-gray-400 pt-1">
                      {new Date(item.created_at).toLocaleDateString(locale)}
                    </p>
                    <span className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-brand-700">
                      <Icon name="externalLink" className="h-3.5 w-3.5" />
                      {locale === "ar" ? "فتح التشخيص" : "Consulter le diagnostic"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
