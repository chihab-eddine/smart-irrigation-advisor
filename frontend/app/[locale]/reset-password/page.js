"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { Banner, Button, Card, Input, Spinner } from "@/components/ui";
import { friendlyAuthError } from "@/lib/auth-errors";

export default function ResetPasswordPage() {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const supabase = createClient();

  const [authReady, setAuthReady] = useState(false);
  const [authMissing, setAuthMissing] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setAuthReady(true);
      else setAuthMissing(true);
    });
  }, [supabase]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError(ar ? "اختر كلمة سر من 8 رموز على الأقل." : "Choisissez un mot de passe d'au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError(ar ? "كلمتا السر غير متطابقتين." : "Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(friendlyAuthError(err, locale));
      return;
    }
    setDone(true);
    setTimeout(() => router.push(`/${locale}/today`), 1500);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "var(--gradient-sunrise)" }}>
      <div className="flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          <Link href={`/${locale}`} className="inline-flex items-center gap-2.5 mb-6" aria-label="Saqi">
            <span className="h-10 w-10 rounded-xl bg-[var(--color-primary-600)] text-white inline-flex items-center justify-center shadow-[var(--shadow-1)]">
              <Icon name="droplet" className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="text-lg font-semibold text-[var(--color-text-strong)] tracking-tight">Saqi</span>
          </Link>

          <h1 className="display text-3xl sm:text-4xl text-[var(--color-text-strong)]">
            {ar ? "كلمة سر جديدة" : "Nouveau mot de passe"}
          </h1>
          <p className="mt-2 text-[15px] text-[var(--color-text-muted)] max-w-sm">
            {ar
              ? "اختر كلمة سر قوية. ستبقى نشطة على كل أجهزتك."
              : "Choisissez un mot de passe robuste. Il restera valable sur tous vos appareils."}
          </p>

          <Card padding="lg" surface="raised" radius="lg" className="mt-6">
            {authMissing ? (
              <Banner tone="warning" title={ar ? "رابط منتهٍ" : "Lien expiré"}>
                {ar
                  ? "انتهت صلاحية رابط إعادة التعيين أو هو غير صالح. اطلب رابطاً جديداً."
                  : "Le lien de réinitialisation est invalide ou a expiré. Demandez un nouveau lien."}
                <div className="mt-3">
                  <Button href={`/${locale}/forgot-password`} variant="secondary" size="sm" leadingIcon="arrowLeft">
                    {ar ? "طلب رابط جديد" : "Demander un nouveau lien"}
                  </Button>
                </div>
              </Banner>
            ) : !authReady ? (
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] py-4">
                <Spinner size="sm" />
                {ar ? "جارٍ التحقق..." : "Vérification…"}
              </div>
            ) : done ? (
              <Banner tone="success" title={ar ? "تم تحديث كلمة السر" : "Mot de passe mis à jour"}>
                {ar ? "جارٍ إعادة التوجيه..." : "Redirection…"}
              </Banner>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <Input
                  type="password"
                  label={ar ? "كلمة السر الجديدة" : "Nouveau mot de passe"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  leadingIcon="shield"
                  hint={ar ? "8 رموز على الأقل" : "Au moins 8 caractères"}
                />
                <Input
                  type="password"
                  label={ar ? "تأكيد كلمة السر" : "Confirmer"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  leadingIcon="shield"
                />
                {error && <Banner tone="danger" icon="alertTriangle">{error}</Banner>}
                <Button type="submit" loading={loading} size="lg" fullWidth trailingIcon="check">
                  {ar ? "حفظ كلمة السر" : "Enregistrer le mot de passe"}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
