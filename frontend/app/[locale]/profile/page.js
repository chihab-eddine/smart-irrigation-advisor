"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { createAPIClient } from "@/lib/api";
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Input,
  List,
  ListItem,
  MetricCard,
  Select,
  Skeleton,
  Stat,
  Switch,
  Tabs,
  Tag,
  ThemeToggle,
  ToastProvider,
  useToast,
  cn,
} from "@/components/ui";
import {
  deletePlot,
  listPlots,
  setActivePlotId,
  subscribePlots,
  resetOnboarding,
} from "@/lib/plots";
import { friendlyAuthError } from "@/lib/auth-errors";
import { signOutAndRedirect } from "@/lib/auth-actions";

export default function ProfilePage() {
  return (
    <ToastProvider>
      <ProfileInner />
    </ToastProvider>
  );
}

function ProfileInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const sp = useSearchParams();
  const supabase = createClient();
  const toast = useToast();
  const { user, profile: authProfile, accessToken } = useAuth();

  const [tab, setTab] = useState(sp.get("tab") || "account");
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [prefs, setPrefs] = useState(null);
  const [crops, setCrops] = useState([]);
  const [regions, setRegions] = useState([]);
  const [irrigationTotal, setIrrigationTotal] = useState(0);
  const [diseaseTotal, setDiseaseTotal] = useState(0);
  const [plots, setPlots] = useState([]);

  const [savingName, setSavingName] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (user === null) router.replace(`/${locale}/login?next=/profile`);
  }, [user, locale, router]);

  // Hydrate name from auth metadata
  useEffect(() => {
    setFullName(user?.user_metadata?.full_name || authProfile?.full_name || "");
  }, [user, authProfile]);

  // Plot subscription
  useEffect(() => {
    const refresh = () => setPlots(listPlots());
    refresh();
    return subscribePlots(refresh);
  }, []);

  // Server-side data load
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const client = createAPIClient(accessToken);
        const [p, c, r, irr, dis] = await Promise.all([
          client.getNotificationPrefs().catch(() => null),
          client.getCrops().catch(() => []),
          client.getRegions().catch(() => []),
          client.getIrrigationHistory(1).catch(() => ({ total: 0 })),
          client.getDiseaseHistory(1).catch(() => ({ total: 0 })),
        ]);
        if (cancelled) return;
        setPrefs(
          p || {
            notification_enabled: false,
            notification_hour: 7,
            notification_minute: 0,
            notification_region_id: null,
            notification_crop_id: null,
            notification_planting_date: null,
          }
        );
        setCrops(c || []);
        setRegions(r || []);
        setIrrigationTotal(irr?.total ?? 0);
        setDiseaseTotal(dis?.total ?? 0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken]);

  const displayName = fullName || user?.email?.split("@")[0] || "";
  const joinedAt = user?.created_at
    ? new Intl.DateTimeFormat(ar ? "ar-MA" : "fr-FR", { month: "long", year: "numeric" }).format(new Date(user.created_at))
    : "—";

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    try {
      const { error: e1 } = await supabase.auth.updateUser({ data: { full_name: fullName } });
      if (e1) throw e1;
      await supabase.from("users").update({ full_name: fullName }).eq("id", user.id);
      toast.push({ tone: "success", title: ar ? "تم التحديث" : "Profil mis à jour" });
    } catch (err) {
      toast.push({ tone: "danger", title: friendlyAuthError(err, locale) });
    } finally {
      setSavingName(false);
    }
  };

  const savePrefs = async (e) => {
    e.preventDefault();
    if (!accessToken) return;
    setSavingPrefs(true);
    try {
      const client = createAPIClient(accessToken);
      const updated = await client.updateNotificationPrefs(prefs);
      setPrefs(updated);
      toast.push({
        tone: "success",
        title: ar ? "تم حفظ التفضيلات" : "Préférences enregistrées",
      });
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setSavingPrefs(false);
    }
  };

  const sendTestReminder = async () => {
    if (!accessToken) return;
    setSendingTest(true);
    try {
      const client = createAPIClient(accessToken);
      const res = await client.sendTestReminder(locale);
      toast.push({
        tone: "success",
        title: ar ? "تم الإرسال" : "Email envoyé",
        description: ar ? `إلى ${res.to}` : `Envoyé à ${res.to}`,
      });
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setSendingTest(false);
    }
  };

  const resetPassword = async () => {
    if (!user?.email) return;
    setResettingPw(true);
    try {
      const { error: e1 } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/${locale}/reset-password`,
      });
      if (e1) throw e1;
      toast.push({
        tone: "success",
        title: ar ? "تم إرسال الرابط" : "Lien envoyé",
        description: ar ? "تحقق من بريدك." : "Vérifiez votre boîte mail.",
      });
    } catch (err) {
      toast.push({ tone: "danger", title: friendlyAuthError(err, locale) });
    } finally {
      setResettingPw(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    await signOutAndRedirect({ locale, to: "/login" });
  };

  const removePlot = (id) => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      ar ? "حذف هذه القطعة؟ لا يمكن التراجع." : "Supprimer cette parcelle ? Action irréversible."
    );
    if (!ok) return;
    deletePlot(id);
    toast.push({ tone: "success", title: ar ? "تم الحذف" : "Parcelle supprimée" });
  };

  const restartOnboarding = () => {
    resetOnboarding();
    router.push(`/${locale}/onboarding`);
  };

  return (
    <div className="page-container py-6 sm:py-10 max-w-4xl">
      {/* HEADER */}
      <header className="mb-6">
        <div className="flex items-center gap-5 flex-wrap">
          <Avatar name={displayName} size="xl" variant="primary" />
          <div className="flex-1 min-w-0">
            <h1 className="display text-3xl text-[var(--color-text-strong)] tracking-tight truncate">
              {displayName || "—"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5 truncate">{user?.email}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Badge variant="primary" icon="shield">
                {authProfile?.role || "user"}
              </Badge>
              <Badge variant="neutral" icon="calendar">
                {ar ? "منذ" : "Depuis"} {joinedAt}
              </Badge>
            </div>
          </div>
          <Button onClick={signOut} variant="secondary" leadingIcon="logout" loading={signingOut}>
            {ar ? "الخروج" : "Se déconnecter"}
          </Button>
        </div>
      </header>

      {/* TABS */}
      <div className="mb-5">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "account",      label: ar ? "الحساب" : "Compte" },
            { value: "plots",        label: ar ? "قطعي" : "Mes parcelles" },
            { value: "notifications",label: ar ? "الإشعارات" : "Rappels" },
            { value: "security",     label: ar ? "الأمان" : "Sécurité" },
          ]}
        />
      </div>

      {tab === "account" && (
        <div className="space-y-5">
          {loading ? (
            <Skeleton height={180} />
          ) : (
            <>
              <Card padding="md">
                <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)] mb-4">
                  {ar ? "معلوماتك" : "Vos informations"}
                </h3>
                <form onSubmit={saveName} className="space-y-4">
                  <Input
                    label={ar ? "الاسم الكامل" : "Nom complet"}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                    leadingIcon="user"
                  />
                  <Input
                    label={ar ? "البريد الإلكتروني" : "Email"}
                    value={user?.email || ""}
                    disabled
                    leadingIcon="mail"
                    hint={ar ? "لا يمكن تغييره مباشرة." : "Non modifiable directement."}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" loading={savingName} leadingIcon="check">
                      {ar ? "حفظ" : "Enregistrer"}
                    </Button>
                  </div>
                </form>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MetricCard
                  icon="droplet"
                  accent="primary"
                  label={ar ? "حسابات الري" : "Calculs d'irrigation"}
                  value={irrigationTotal.toLocaleString(ar ? "ar-MA" : "fr-FR")}
                  href={`/${locale}/irrigation/history`}
                />
                <MetricCard
                  icon="leaf"
                  accent="secondary"
                  label={ar ? "تشخيصات الأمراض" : "Diagnostics"}
                  value={diseaseTotal.toLocaleString(ar ? "ar-MA" : "fr-FR")}
                  href={`/${locale}/disease/history`}
                />
              </div>

              <Card padding="none">
                <List>
                  <ListItem
                    icon="dashboard"
                    iconBg="primary"
                    title={ar ? "لوحة التحكم" : "Tableau de bord"}
                    description={ar ? "كل تاريخك مع Saqi." : "Tout votre historique avec Saqi."}
                    href={`/${locale}/dashboard`}
                  />
                  <ListItem
                    icon="cloud"
                    iconBg="accent"
                    title={ar ? "السمة" : "Thème"}
                    description={ar ? "فاتح، داكن، أو حسب النظام." : "Clair, sombre, ou selon le système."}
                    trailing={<ThemeToggle />}
                    showChevron={false}
                  />
                  <ListItem
                    icon="languages"
                    iconBg="neutral"
                    title={ar ? "اللغة" : "Langue"}
                    description={ar ? "العربية أو الفرنسية." : "Français ou arabe."}
                    trailing={
                      <span className="text-sm font-medium text-[var(--color-text-muted)]">
                        {ar ? "العربية" : "Français"}
                      </span>
                    }
                    showChevron={false}
                  />
                </List>
              </Card>
            </>
          )}
        </div>
      )}

      {tab === "plots" && (
        <div className="space-y-5">
          {plots.length === 0 ? (
            <Card padding="lg">
              <EmptyState
                icon="sprout"
                title={ar ? "لا قطعة بعد" : "Aucune parcelle"}
                description={
                  ar
                    ? "أضف قطعتك الأولى لتحصل على حسابات يومية تلقائية."
                    : "Ajoutez votre première parcelle pour un calcul quotidien automatique."
                }
                action={
                  <Button href={`/${locale}/onboarding`} leadingIcon="check">
                    {ar ? "إضافة قطعة" : "Configurer une parcelle"}
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <Card padding="none">
                <List>
                  {plots.map((p) => (
                    <ListItem
                      key={p.id}
                      icon="sprout"
                      iconBg="primary"
                      title={p.name}
                      description={`${p.crop || "—"} · ${p.region || "—"} · ${p.irrigationSystem || "drip"}`}
                      trailing={
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActivePlotId(p.id); router.push(`/${locale}/today`); }}
                            className="h-9 px-3 text-xs font-medium rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-200)]"
                          >
                            {ar ? "افتح" : "Ouvrir"}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); removePlot(p.id); }}
                            aria-label={ar ? "حذف" : "Supprimer"}
                            className="h-9 w-9 inline-flex items-center justify-center rounded-full text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </div>
                      }
                      showChevron={false}
                    />
                  ))}
                </List>
              </Card>
              <div className="flex flex-wrap gap-2">
                <Button href={`/${locale}/onboarding?add=1`} leadingIcon="check">
                  {ar ? "إضافة قطعة" : "Ajouter une parcelle"}
                </Button>
                <Button onClick={restartOnboarding} variant="ghost" leadingIcon="refresh">
                  {ar ? "إعادة الإعداد" : "Refaire l'onboarding"}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "notifications" && (
        <Card padding="md">
          {loading || !prefs ? (
            <Skeleton height={140} />
          ) : (
            <form onSubmit={savePrefs} className="space-y-5">
              <Switch
                label={ar ? "تذكير يومي بالبريد" : "Rappel quotidien par email"}
                description={
                  ar
                    ? "كل صباح، ملخص قصير بكمية الري والطقس."
                    : "Chaque matin, un résumé court avec la dose et la météo."
                }
                checked={Boolean(prefs.notification_enabled)}
                onChange={(v) => setPrefs({ ...prefs, notification_enabled: v })}
              />

              {prefs.notification_enabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label={ar ? "الساعة" : "Heure"}
                      value={String(prefs.notification_hour ?? 7)}
                      onChange={(e) => setPrefs({ ...prefs, notification_hour: Number(e.target.value) })}
                      options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: String(h).padStart(2, "0") }))}
                    />
                    <Select
                      label={ar ? "الدقيقة" : "Minute"}
                      value={String(prefs.notification_minute ?? 0)}
                      onChange={(e) => setPrefs({ ...prefs, notification_minute: Number(e.target.value) })}
                      options={[0, 15, 30, 45].map((m) => ({ value: String(m), label: String(m).padStart(2, "0") }))}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select
                      label={ar ? "المنطقة الافتراضية" : "Région par défaut"}
                      value={prefs.notification_region_id || ""}
                      onChange={(e) => setPrefs({ ...prefs, notification_region_id: e.target.value ? Number(e.target.value) : null })}
                      placeholder={ar ? "اختر..." : "Choisir…"}
                      options={regions.map((r) => ({ value: r.id, label: ar ? r.name_ar : r.name_fr }))}
                    />
                    <Select
                      label={ar ? "المحصول الافتراضي" : "Culture par défaut"}
                      value={prefs.notification_crop_id || ""}
                      onChange={(e) => setPrefs({ ...prefs, notification_crop_id: e.target.value ? Number(e.target.value) : null })}
                      placeholder={ar ? "اختر..." : "Choisir…"}
                      options={crops.map((c) => ({ value: c.id, label: ar ? c.name_ar : c.name_fr }))}
                    />
                  </div>
                </>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--color-border-subtle)]">
                <Button type="submit" loading={savingPrefs} leadingIcon="check">
                  {ar ? "حفظ" : "Enregistrer"}
                </Button>
                {prefs.notification_enabled && (
                  <Button
                    type="button"
                    onClick={sendTestReminder}
                    loading={sendingTest}
                    variant="ghost"
                    leadingIcon="send"
                  >
                    {ar ? "إرسال اختبار" : "Envoyer un test"}
                  </Button>
                )}
              </div>
            </form>
          )}
        </Card>
      )}

      {tab === "security" && (
        <div className="space-y-5">
          <Card padding="md">
            <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
              {ar ? "كلمة السر" : "Mot de passe"}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {ar
                ? "نرسل لك رابطاً آمناً لتغيير كلمة السر."
                : "Nous vous envoyons un lien sécurisé pour le modifier."}
            </p>
            <div className="mt-4">
              <Button onClick={resetPassword} loading={resettingPw} leadingIcon="mail">
                {ar ? "أرسل رابط إعادة التعيين" : "Envoyer le lien"}
              </Button>
            </div>
          </Card>

          <Card padding="md">
            <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
              {ar ? "خصوصية البيانات" : "Confidentialité"}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">
              {ar
                ? "بياناتك تبقى ملكك. لا نبيع أو نشارك معلوماتك مع طرف ثالث."
                : "Vos données vous appartiennent. Nous ne vendons jamais vos informations à des tiers."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button href={`/${locale}/privacy`} variant="ghost" trailingIcon="arrowRight">
                {ar ? "سياسة الخصوصية" : "Politique de confidentialité"}
              </Button>
              <Button href={`/${locale}/terms`} variant="ghost" trailingIcon="arrowRight">
                {ar ? "شروط الاستخدام" : "Conditions d'utilisation"}
              </Button>
            </div>
          </Card>

          <Card padding="md" className="border-[var(--color-danger-border)]">
            <h3 className="text-[15px] font-semibold text-[var(--color-danger)]">
              {ar ? "حذف الحساب" : "Supprimer le compte"}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1 leading-relaxed">
              {ar
                ? "إذا أردت إغلاق حسابك نهائياً، تواصل معنا وسنتولى العملية في غضون 7 أيام."
                : "Pour fermer votre compte définitivement, contactez-nous. Nous traitons votre demande sous 7 jours."}
            </p>
            <div className="mt-4">
              <Button href={`/${locale}/contact?subject=delete-account`} variant="secondary" leadingIcon="mail">
                {ar ? "تواصل لحذف الحساب" : "Demander la suppression"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
