"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Icon from "@/components/Icon";
import { Banner, Button, Card, EmptyState, Input } from "@/components/ui";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function ForgotPasswordPage() {
  const locale = useLocale();
  const ar = locale === "ar";
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?locale=${locale}`,
      });
      if (err) {
        setError(friendlyAuthError(err, locale));
      } else {
        // Privacy: always confirm "sent" even if account doesn't exist
        setSent(true);
      }
    } catch (e) {
      setError(friendlyAuthError(e, locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={ar ? "نسيت كلمة السر؟" : "Mot de passe oublié ?"}
      subtitle={
        ar
          ? "أدخل بريدك. سنرسل لك رابط إعادة التعيين."
          : "Entrez votre email. Nous vous enverrons un lien pour le réinitialiser."
      }
      locale={locale}
    >
      {sent ? (
        <EmptyState
          icon="mail"
          title={ar ? "تحقق من بريدك" : "Vérifiez votre email"}
          description={
            ar
              ? "إذا كان هناك حساب بهذا البريد، ستصلك رسالة فيها رابط لإعادة تعيين كلمة السر."
              : "Si un compte existe pour cet email, vous recevrez un message avec un lien pour réinitialiser votre mot de passe."
          }
          action={
            <Button href={`/${locale}/login`} leadingIcon="arrowLeft">
              {ar ? "العودة إلى تسجيل الدخول" : "Retour à la connexion"}
            </Button>
          }
        />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
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
          {error && <Banner tone="danger" icon="alertTriangle">{error}</Banner>}
          <Button
            type="submit"
            loading={loading}
            size="lg"
            fullWidth
            trailingIcon="send"
          >
            {ar ? "أرسل الرابط" : "Envoyer le lien"}
          </Button>
          <div className="text-center text-sm">
            <Link
              href={`/${locale}/login`}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
            >
              {ar ? "العودة إلى تسجيل الدخول" : "Retour à la connexion"}
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

function AuthLayout({ title, subtitle, children, locale }) {
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

          <h1 className="display text-3xl sm:text-4xl text-[var(--color-text-strong)]">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-[15px] text-[var(--color-text-muted)] max-w-sm">{subtitle}</p>
          )}

          <Card padding="lg" surface="raised" radius="lg" className="mt-6">{children}</Card>
        </div>
      </div>
    </div>
  );
}
