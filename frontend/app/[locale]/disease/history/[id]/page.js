"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import Icon from "@/components/Icon";
import Spinner from "@/components/Spinner";
import AITipsCard from "@/components/AITipsCard";
import { createAPIClient } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const LOW_CONFIDENCE_THRESHOLD = 0.5;

export default function DiseaseDiagnosisPage() {
  const locale = useLocale();
  const ar = locale === "ar";
  const params = useParams();
  const supabase = createClient();

  const [diagnosis, setDiagnosis] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: { session: activeSession } } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(activeSession);
      if (!activeSession) {
        setLoading(false);
        return;
      }

      try {
        const client = createAPIClient(activeSession.access_token);
        const data = await client.getDiseaseDiagnosis(params.id, locale);
        if (!cancelled) setDiagnosis(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load diagnosis");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [supabase, params.id, locale]);

  const confidence = Number(diagnosis?.confidence_score || 0);
  const lowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">

      <main className="flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/disease/history`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            >
              <Icon name="arrowLeft" className="h-4 w-4 rtl-flip" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                {ar ? "تفاصيل التشخيص" : "Détail du diagnostic"}
              </h1>
              <p className="text-sm text-gray-500">
                {ar
                  ? "الصورة المحفوظة، النتيجة، والعلاج."
                  : "Photo sauvegardée, résultat et traitement."}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner className="h-8 w-8 text-brand-600" />
            </div>
          ) : error ? (
            <Alert text={error} />
          ) : diagnosis ? (
            <>
              <section className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  {diagnosis.image_url ? (
                    <div className="aspect-square overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                      <img
                        src={diagnosis.image_url}
                        alt={ar ? "صورة الورقة" : "Photo de feuille"}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="aspect-square rounded-md border border-gray-200 bg-gray-50 text-gray-400 inline-flex w-full items-center justify-center">
                      <Icon name="image" className="h-8 w-8" />
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${
                          lowConfidence
                            ? "border-amber-200 bg-amber-50 text-amber-800"
                            : "border-brand-200 bg-brand-50 text-brand-800"
                        }`}
                      >
                        <Icon
                          name={lowConfidence ? "alertTriangle" : "checkCircle"}
                          className="h-3.5 w-3.5"
                        />
                        {lowConfidence
                          ? ar ? "أقرب فرضية محفوظة" : "Hypothèse sauvegardée la plus proche"
                          : ar ? "تشخيص محفوظ" : "Diagnostic sauvegardé"}
                      </span>
                      <h2 className="mt-3 text-xl font-semibold text-gray-900">
                        {diagnosis.disease_name || diagnosis.disease_key}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500">
                        {diagnosis.crop_type || "—"} ·{" "}
                        {new Date(diagnosis.created_at).toLocaleString(locale)}
                      </p>
                    </div>

                  </div>

                  <div className="mt-5 border-t border-gray-100 pt-5">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                      {ar ? "العلاج / الإجراء" : "Traitement / action"}
                    </p>
                    <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                      {diagnosis.treatment || "—"}
                    </div>
                  </div>
                </div>
              </section>

              <AITipsCard
                title={ar ? "إرشادات إضافية" : "Recommandations complémentaires"}
                dependsOn={[diagnosis?.id, locale]}
                fetcher={async () => {
                  const client = createAPIClient(session?.access_token);
                  return client.aiDiseaseTips({
                    disease_key: diagnosis.disease_key,
                    disease_name: diagnosis.disease_name,
                    confidence_score: diagnosis.confidence_score,
                    crop_type: diagnosis.crop_type,
                    treatment: diagnosis.treatment,
                    locale,
                  });
                }}
              />
            </>
          ) : null}
        </div>
      </main>
    </div>
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
