"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { Banner, Button, Card, Input } from "@/components/ui";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function RegisterPage() {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError(ar ? "اختر كلمة سر من 8 رموز على الأقل." : "Choisissez un mot de passe d'au moins 8 caractères.");
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setError(ar ? "كلمتا السر غير متطابقتين." : "Les mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
          data: { full_name: fullName },
        },
      });
      if (err) {
        setError(friendlyAuthError(err, locale));
        setLoading(false);
        return;
      }
      setSuccess(
        ar
          ? "تم إنشاء الحساب! تحقق من بريدك لتأكيد العنوان."
          : "Compte créé ! Vérifiez votre email pour confirmer l'adresse."
      );
      setLoading(false);
      setTimeout(() => {
        router.push(`/${locale}/login?registered=1`);
      }, 2200);
    } catch (e) {
      setError(friendlyAuthError(e, locale));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={ar ? "ابدأ مع Saqi" : "Créer un compte"}
      subtitle={
        ar
          ? "Saqi مجاني 100٪. بلا إعلانات، بلا التزام."
          : "Saqi est 100 % gratuit. Pas de publicité, pas d'engagement."
      }
      locale={locale}
    >
      <div className="space-y-4">
        <Input
          label={ar ? "الاسم الكامل" : "Nom complet"}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
          leadingIcon="user"
          placeholder={ar ? "محمد العلوي" : "Mohamed Alaoui"}
        />
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
          autoComplete="new-password"
          leadingIcon="shield"
          hint={ar ? "8 رموز على الأقل" : "Au moins 8 caractères"}
        />
        <Input
          type="password"
          label={ar ? "تأكيد كلمة السر" : "Confirmer le mot de passe"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          leadingIcon="shield"
        />

        {error && <Banner tone="danger" icon="alertTriangle">{error}</Banner>}
        {success && <Banner tone="success" icon="checkCircle">{success}</Banner>}

        <Button
          type="button"
          onClick={onSubmit}
          loading={loading}
          size="lg"
          fullWidth
          trailingIcon="arrowRight"
          disabled={Boolean(success)}
        >
          {ar ? "إنشاء الحساب" : "Créer mon compte"}
        </Button>
      </div>

      <div className="mt-6 pt-5 border-t border-[var(--color-border-subtle)] text-center text-sm text-[var(--color-text-muted)]">
        {ar ? "لديك حساب؟ " : "Déjà un compte ? "}
        <Link
          href={`/${locale}/login`}
          className="font-semibold text-[var(--color-primary-700)] hover:underline"
        >
          {ar ? "سجّل دخولك" : "Se connecter"}
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

          <h1 className="display text-3xl sm:text-4xl text-[var(--color-text-strong)]">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-[15px] text-[var(--color-text-muted)] max-w-sm">{subtitle}</p>
          )}

          <Card padding="lg" surface="raised" radius="lg" className="mt-6">{children}</Card>

          <p className="mt-6 text-xs text-center text-[var(--color-text-muted)]">
            {ar
              ? "بالمتابعة، أنت توافق على "
              : "En continuant, vous acceptez nos "}
            <Link href={`/${locale}/terms`} className="underline">{ar ? "الشروط" : "conditions"}</Link>
            {ar ? " و" : " et notre "}
            <Link href={`/${locale}/privacy`} className="underline">{ar ? "الخصوصية" : "politique de confidentialité"}</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
