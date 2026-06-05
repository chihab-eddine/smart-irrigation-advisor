"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { Banner, Button, Card, Input } from "@/components/ui";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function LoginPage() {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (sp.get("error")) {
      setError(
        ar
          ? "انتهت صلاحية الرابط أو هو غير صالح. حاول مجدداً."
          : "Le lien est invalide ou a expiré. Réessayez."
      );
    }
    if (sp.get("registered")) {
      setInfo(
        ar
          ? "تم إنشاء الحساب. تحقق من بريدك لتأكيد العنوان."
          : "Compte créé. Vérifiez votre email pour confirmer l'adresse."
      );
    }
  }, [sp, ar]);

  const next = sp.get("next") || "/today";

  const onSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(friendlyAuthError(err, locale));
        setLoading(false);
        return;
      }
      // Full navigation (not client-side) so the middleware sees fresh cookies.
      const target = `/${locale}${next.startsWith("/") ? next : `/${next}`}`;
      window.location.replace(target);
    } catch (e) {
      setError(friendlyAuthError(e, locale));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={ar ? "مرحباً" : "Bon retour"}
      subtitle={
        ar
          ? "سجّل دخولك للوصول إلى توصياتك اليومية."
          : "Connectez-vous pour retrouver vos recommandations quotidiennes."
      }
      locale={locale}
    >
      {info && (
        <Banner tone="success" className="mb-4">
          {info}
        </Banner>
      )}

      <div className="space-y-4">
        <Input
          type="email"
          label={ar ? "البريد الإلكتروني" : "Adresse email"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          leadingIcon="mail"
          placeholder="vous@example.com"
        />
        <Input
          type="password"
          label={ar ? "كلمة السر" : "Mot de passe"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          leadingIcon="shield"
        />
        {error && (
          <Banner tone="danger" icon="alertTriangle">
            {error}
          </Banner>
        )}
        <Button
          type="button"
          onClick={onSubmit}
          loading={loading}
          size="lg"
          fullWidth
          trailingIcon="arrowRight"
        >
          {ar ? "تسجيل الدخول" : "Se connecter"}
        </Button>
        <div className="text-center text-sm">
          <Link
            href={`/${locale}/forgot-password`}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
          >
            {ar ? "نسيت كلمة السر؟" : "Mot de passe oublié ?"}
          </Link>
        </div>
      </div>

      <div className="mt-6 pt-5 border-t border-[var(--color-border-subtle)] text-center text-sm text-[var(--color-text-muted)]">
        {ar ? "لا حساب لديك؟ " : "Pas encore de compte ? "}
        <Link
          href={`/${locale}/register`}
          className="font-semibold text-[var(--color-primary-700)] hover:underline"
        >
          {ar ? "أنشئ واحداً مجاناً" : "Créer un compte"}
        </Link>
      </div>
    </AuthLayout>
  );
}

function AuthLayout({ title, subtitle, children, locale }) {
  const ar = locale === "ar";
  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "var(--gradient-sunrise)" }}>
      <div className="flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2.5 mb-6"
            aria-label="Saqi"
          >
            <span className="h-10 w-10 rounded-xl bg-[var(--color-primary-600)] text-white inline-flex items-center justify-center shadow-[var(--shadow-1)]">
              <Icon name="droplet" className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="text-lg font-semibold text-[var(--color-text-strong)] tracking-tight">Saqi</span>
          </Link>

          <h1 className="display text-3xl sm:text-4xl text-[var(--color-text-strong)]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 text-[15px] text-[var(--color-text-muted)] max-w-sm">
              {subtitle}
            </p>
          )}

          <Card padding="lg" surface="raised" radius="lg" className="mt-6">
            {children}
          </Card>

          <p className="mt-6 text-xs text-center text-[var(--color-text-muted)]">
            {ar
              ? "بالمتابعة، أنت توافق على "
              : "En continuant, vous acceptez nos "}
            <Link href={`/${locale}/terms`} className="underline">{ar ? "الشروط" : "conditions"}</Link>
            {ar ? " و" : " et notre "}
            <Link href={`/${locale}/privacy`} className="underline">{ar ? "الخصوصية" : "politique de confidentialité"}</Link>
            {ar ? "." : "."}
          </p>
        </div>
      </div>
    </div>
  );
}
