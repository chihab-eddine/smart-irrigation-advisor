"use client";

import { useLocale } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import {
  Badge,
  Button,
  Card,
  Input,
  Stat,
  ToastProvider,
  useToast,
  cn,
} from "@/components/ui";
import { createAPIClient } from "@/lib/api";

export default function LandingPage() {
  return (
    <ToastProvider>
      <Landing />
    </ToastProvider>
  );
}

function Landing() {
  const locale = useLocale();
  const ar = locale === "ar";
  const { user } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [loadingSub, setLoadingSub] = useState(false);

  const subscribe = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoadingSub(true);
    try {
      const client = createAPIClient();
      const res = await client.subscribeNewsletter({ email, locale });
      if (res.success) {
        toast.push({
          tone: "success",
          title: ar ? "تم الاشتراك" : "Inscription confirmée",
          description: ar ? "ستصلك أخبارنا قريباً." : "Vous recevrez bientôt nos nouvelles.",
        });
        setEmail("");
      } else {
        toast.push({ tone: "warning", title: res.message });
      }
    } catch {
      toast.push({
        tone: "danger",
        title: ar ? "تعذر الاشتراك" : "Inscription impossible",
        description: ar ? "حاول لاحقاً." : "Réessayez plus tard.",
      });
    } finally {
      setLoadingSub(false);
    }
  };

  const ctaTarget = user ? `/${locale}/today` : `/${locale}/register`;
  const ctaText = user
    ? ar ? "افتح Saqi" : "Ouvrir Saqi"
    : ar ? "ابدأ الآن" : "Commencer";

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-sunrise)" }}
          aria-hidden="true"
        />
        <div className="page-container pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="max-w-2xl">
            <Badge variant="primary" icon="leaf" size="lg">
              {ar ? "للمزارعين المغاربة" : "Conçu pour les agriculteurs marocains"}
            </Badge>
            <h1 className="display mt-6 text-[44px] sm:text-[64px] leading-[1.02] text-[var(--color-text-strong)]">
              {ar ? "كم من الماء" : "Combien d'eau"}
              <br />
              <span className="text-[var(--color-primary-700)]">
                {ar ? "اليوم؟" : "aujourd'hui ?"}
              </span>
            </h1>
            <p className="mt-5 text-lg text-[var(--color-text)] max-w-xl leading-relaxed">
              {ar
                ? "Saqi يعطيك جواباً واضحاً لكل قطعة، مبنياً على الطقس وعلم الزراعة. ودقيقة لتشخيص أي ورقة مريضة."
                : "Saqi vous donne une réponse claire pour chaque parcelle, basée sur la météo et l'agronomie. Et une minute pour diagnostiquer une feuille malade."}
            </p>
            <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <Button href={ctaTarget} size="xl" trailingIcon="arrowRight">
                {ctaText}
              </Button>
              <Button href="#how" variant="ghost" size="xl" trailingIcon="chevronDown">
                {ar ? "كيف يعمل" : "Voir comment ça marche"}
              </Button>
            </div>
            <p className="mt-4 text-sm text-[var(--color-text-muted)] flex items-center gap-2 flex-wrap">
              <Icon name="check" className="h-4 w-4 text-[var(--color-success)]" />
              {ar ? "مجاني 100٪" : "100 % gratuit"}
              <span className="text-[var(--color-text-subtle)]">·</span>
              <Icon name="check" className="h-4 w-4 text-[var(--color-success)]" />
              {ar ? "بالعربية والفرنسية" : "En français et en arabe"}
              <span className="text-[var(--color-text-subtle)]">·</span>
              <Icon name="check" className="h-4 w-4 text-[var(--color-success)]" />
              {ar ? "يعمل خارج التغطية" : "Fonctionne hors réseau"}
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="page-container py-16 sm:py-24">
        <div className="max-w-2xl">
          <Badge variant="secondary" size="md">{ar ? "كيف يعمل" : "Comment ça marche"}</Badge>
          <h2 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
            {ar ? "ثلاث خطوات. توصية واحدة." : "Trois étapes. Une réponse claire."}
          </h2>
          <p className="mt-3 text-[var(--color-text-muted)] text-[15px]">
            {ar
              ? "نتولى الحسابات العلمية. أنت تركز على الميدان."
              : "Nous faisons les calculs scientifiques. Vous restez concentré sur le terrain."}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              n: "01",
              fr: { t: "Décrivez votre parcelle", d: "Culture, région, type de sol. En 90 secondes." },
              ar: { t: "عرّف بقطعتك", d: "المحصول، المنطقة، نوع التربة. في 90 ثانية." },
              icon: "sprout",
            },
            {
              n: "02",
              fr: { t: "Saqi lit le ciel", d: "Météo locale, prévisions à 7 jours, stade de la culture." },
              ar: { t: "Saqi يقرأ السماء", d: "طقس محلي، توقعات 7 أيام، مرحلة المحصول." },
              icon: "cloud",
            },
            {
              n: "03",
              fr: { t: "Vous arrosez juste ce qu'il faut", d: "Une dose claire chaque matin. Plus de gaspillage." },
              ar: { t: "تسقي القدر المناسب فقط", d: "كمية واضحة كل صباح. لا هدر للماء." },
              icon: "droplet",
            },
          ].map((step, i) => {
            const m = ar ? step.ar : step.fr;
            return (
              <Card key={i} surface="raised" padding="md" radius="md">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold tracking-widest text-[var(--color-primary-700)] num">
                    {step.n}
                  </span>
                  <span className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
                    <Icon name={step.icon} className="h-5 w-5" />
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">{m.t}</h3>
                <p className="mt-1.5 text-[15px] text-[var(--color-text-muted)] leading-relaxed">{m.d}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="page-container py-16 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <FeatureCard
            tone="leaf"
            icon="droplet"
            title={ar ? "ري ذكي" : "Irrigation intelligente"}
            desc={
              ar
                ? "كمية الري بالملم واللتر، لكل قطعة، يومياً."
                : "La dose en mm et en litres, pour chaque parcelle, chaque jour."
            }
          />
          <FeatureCard
            tone="sky"
            icon="image"
            title={ar ? "تشخيص الأمراض" : "Diagnostic des maladies"}
            desc={
              ar
                ? "صوّر الورقة. نقترح علاجاً عملياً في ثوانٍ."
                : "Photographiez la feuille. Diagnostic et traitement en quelques secondes."
            }
          />
          <FeatureCard
            tone="warm"
            icon="cloud"
            title={ar ? "تنبيه الجفاف" : "Alerte sécheresse"}
            desc={
              ar
                ? "نعلمك قبل موجة الحرارة. وتخفّض الفاتورة."
                : "Soyez prévenu avant la vague de chaleur. Et économisez."
            }
          />
        </div>
      </section>

      {/* WATER CRISIS — TRUST */}
      <section className="py-16 sm:py-24" style={{ background: "var(--color-surface-muted)" }}>
        <div className="page-container">
          <div className="max-w-2xl">
            <Badge variant="warning" icon="alertCircle">
              {ar ? "السياق" : "Le contexte"}
            </Badge>
            <h2 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
              {ar ? "كل قطرة تُحسب." : "Chaque goutte compte."}
            </h2>
            <p className="mt-3 text-[var(--color-text-muted)] text-[15px]">
              {ar
                ? "بيانات رسمية من المؤسسات المرجعية بالمغرب."
                : "Données officielles, sources institutionnelles marocaines."}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                v: "87%",
                fr: { t: "Eau pour l'agriculture", d: "Part de l'eau utilisée pour cultiver au Maroc.", s: "HCP · ONEE" },
                ar: { t: "ماء الزراعة", d: "حصة الزراعة من الماء بالمغرب.", s: "HCP · ONEE" },
              },
              {
                v: "~28%",
                fr: { t: "Remplissage des barrages", d: "Taux moyen des barrages au début de 2025.", s: "MEE" },
                ar: { t: "نسبة ملء السدود", d: "متوسط ملء السدود مطلع 2025.", s: "MEE" },
              },
              {
                v: "7",
                fr: { t: "Années de sécheresse", d: "Années consécutives (2018–2024).", s: "DMN" },
                ar: { t: "سنوات الجفاف", d: "سنوات متتالية (2018–2024).", s: "DMN" },
              },
            ].map((c, i) => {
              const m = ar ? c.ar : c.fr;
              return (
                <Card key={i} surface="default" padding="md">
                  <Stat value={c.v} label={m.t} size="lg" />
                  <p className="mt-2 text-[15px] text-[var(--color-text)] leading-relaxed">{m.d}</p>
                  <p className="mt-3 text-xs text-[var(--color-text-subtle)] font-medium tracking-wide">
                    {ar ? "المصدر" : "Source"} · {m.s}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="page-container py-16 sm:py-20">
        <Card surface="warm" padding="lg" radius="lg" className="max-w-3xl mx-auto">
          <Icon name="check" className="h-6 w-6 text-[var(--color-primary-700)]" />
          <p className="mt-4 text-xl sm:text-2xl text-[var(--color-text-strong)] leading-snug">
            {ar
              ? "« مع Saqi، أعرف بالضبط متى أسقي. خفّضت فاتورتي بالثلث في موسم واحد. »"
              : "« Avec Saqi, je sais exactement quand arroser. J'ai réduit ma facture d'un tiers en une saison. »"}
          </p>
          <div className="mt-5 flex items-center gap-3">
            <span className="h-10 w-10 rounded-full bg-[var(--color-primary-600)] text-white inline-flex items-center justify-center font-semibold">
              H
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                Hassan B., {ar ? "بني ملال" : "Beni Mellal"}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                4 ha {ar ? "زيتون" : "d'oliviers"}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section className="page-container py-16 sm:py-24">
        <Card surface="invert" padding="lg" radius="lg" className="text-center max-w-3xl mx-auto">
          <h2 className="display text-3xl sm:text-4xl">
            {ar ? "ابدأ في دقيقة." : "Commencez en une minute."}
          </h2>
          <p className="mt-3 text-[15px] opacity-80 max-w-md mx-auto">
            {ar
              ? "كل شيء مجاني. بلا إعلانات، بلا التزام."
              : "Tout est gratuit. Pas de publicité, pas d'engagement."}
          </p>
          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-2">
            <Button href={ctaTarget} size="xl" variant="warm" trailingIcon="arrowRight">
              {ctaText}
            </Button>
            <Button href={`/${locale}/contact`} size="xl" variant="ghost" className="!text-white hover:!bg-white/10">
              {ar ? "تكلم معنا" : "Nous contacter"}
            </Button>
          </div>
        </Card>
      </section>

      {/* NEWSLETTER */}
      <section className="page-container pb-16 sm:pb-24">
        <Card padding="md" className="max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-[var(--color-text-strong)]">
                {ar ? "نشرة موسمية" : "Lettre saisonnière"}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {ar
                  ? "نصائح موسمية وتنبيهات الطقس. رسالة واحدة في الشهر."
                  : "Conseils saisonniers et alertes météo. Un message par mois."}
              </p>
            </div>
            <form onSubmit={subscribe} className="flex gap-2 sm:w-[360px]">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={ar ? "بريدك الإلكتروني" : "Votre email"}
                required
                className="flex-1"
              />
              <Button
                type="submit"
                loading={loadingSub}
                iconOnly
                leadingIcon="send"
                aria-label={ar ? "اشتراك" : "S'inscrire"}
              />
            </form>
          </div>
        </Card>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[var(--color-border)] py-10">
        <div className="page-container flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-[var(--color-primary-600)] text-white">
              <Icon name="droplet" className="h-4 w-4" strokeWidth={2} />
            </span>
            <span className="text-sm text-[var(--color-text-muted)]">
              © {new Date().getFullYear()} Saqi
            </span>
          </div>
          <nav className="flex gap-5 text-sm text-[var(--color-text-muted)]">
            <Link href={`/${locale}/privacy`} className="hover:text-[var(--color-text-strong)]">
              {ar ? "الخصوصية" : "Confidentialité"}
            </Link>
            <Link href={`/${locale}/terms`} className="hover:text-[var(--color-text-strong)]">
              {ar ? "الشروط" : "Conditions"}
            </Link>
            <Link href={`/${locale}/contact`} className="hover:text-[var(--color-text-strong)]">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ tone, icon, title, desc }) {
  return (
    <Card surface={tone} padding="md" radius="md">
      <span
        className={cn(
          "h-12 w-12 inline-flex items-center justify-center rounded-2xl text-white",
          tone === "leaf" && "bg-[var(--color-primary-600)]",
          tone === "sky" && "bg-[var(--color-accent-500)]",
          tone === "warm" && "bg-[var(--color-secondary-500)]"
        )}
      >
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <h3 className="mt-5 text-lg font-semibold text-[var(--color-text-strong)]">{title}</h3>
      <p className="mt-1.5 text-[15px] text-[var(--color-text)] leading-relaxed">{desc}</p>
    </Card>
  );
}
