"use client";

import { useLocale } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/Icon";
import Spinner from "@/components/Spinner";
import { createAPIClient } from "@/lib/api";

export default function NewsletterPage() {
  const locale = useLocale();
  const ar = locale === "ar";

  const [email, setEmail] = useState("");
  const [mode, setMode] = useState("subscribe");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const copy = {
    title: ar ? "النشرة الإخبارية" : "Newsletter",
    subtitle: ar
      ? "تابع نصائح الري، تنبيهات الجفاف، وتحسينات المنصة."
      : "Suivez les conseils d'irrigation, les alertes sécheresse et les nouveautés de la plateforme.",
    subscribe: ar ? "اشتراك" : "S'abonner",
    unsubscribe: ar ? "إلغاء الاشتراك" : "Se désabonner",
    placeholder: ar ? "بريدك الإلكتروني" : "Votre adresse email",
    successSubscribe: ar ? "تم الاشتراك بنجاح." : "Abonnement réussi.",
    successUnsubscribe: ar ? "تم إلغاء الاشتراك بنجاح." : "Désabonnement réussi.",
    error: ar ? "تعذر تنفيذ الطلب. حاول مرة أخرى." : "Impossible de traiter la demande. Réessayez.",
    backContact: ar ? "تواصل معنا" : "Nous contacter",
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");

    try {
      const client = createAPIClient();
      const res =
        mode === "subscribe"
          ? await client.subscribeNewsletter({ email, locale })
          : await client.unsubscribeNewsletter({ email });

      if (res.success) {
        setSuccess(mode === "subscribe" ? copy.successSubscribe : copy.successUnsubscribe);
        setEmail("");
      } else {
        setError(res.message || copy.error);
      }
    } catch (err) {
      setError(err.message || copy.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">

      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {copy.title}
            </h1>
            <p className="mt-1 text-sm text-gray-600">{copy.subtitle}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-5 inline-flex h-10 rounded-md border border-gray-300 bg-gray-50 p-1">
              {[
                { id: "subscribe", label: copy.subscribe, icon: "mail" },
                { id: "unsubscribe", label: copy.unsubscribe, icon: "close" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setMode(item.id);
                    setSuccess("");
                    setError("");
                  }}
                  className={`inline-flex items-center justify-center gap-2 rounded px-3 text-sm font-medium transition-colors ${
                    mode === item.id
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </div>

            {success && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-brand-200 bg-brand-50 p-3 text-sm text-brand-800">
                <Icon name="checkCircle" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <Icon name="alertCircle" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={copy.placeholder}
                className="h-11 flex-1 rounded-md border border-gray-300 bg-white px-3.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {loading ? <Spinner className="h-4 w-4 text-white" /> : null}
                <Icon name={mode === "subscribe" ? "mail" : "close"} className="h-4 w-4" />
                {mode === "subscribe" ? copy.subscribe : copy.unsubscribe}
              </button>
            </form>
          </div>

          <div className="mt-5">
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              <Icon name="send" className="h-4 w-4" />
              {copy.backContact}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
