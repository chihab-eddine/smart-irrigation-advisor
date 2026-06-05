"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import {
  Button,
  Card,
  Input,
  Select,
  Stepper,
  Switch,
  Tag,
  TopBar,
  cn,
} from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { markOnboarded, savePlot } from "@/lib/plots";

const CROPS = [
  { name_fr: "Blé", name_ar: "قمح", icon: "sprout" },
  { name_fr: "Maïs", name_ar: "ذرة", icon: "sprout" },
  { name_fr: "Tomate", name_ar: "طماطم", icon: "leaf" },
  { name_fr: "Olivier", name_ar: "زيتون", icon: "leaf" },
  { name_fr: "Agrumes", name_ar: "حوامض", icon: "sun" },
  { name_fr: "Pomme de terre", name_ar: "بطاطس", icon: "sprout" },
  { name_fr: "Luzerne", name_ar: "فصة", icon: "sprout" },
  { name_fr: "Betterave sucrière", name_ar: "شمندر سكري", icon: "sprout" },
  { name_fr: "Oignon", name_ar: "بصل", icon: "sprout" },
  { name_fr: "Haricot", name_ar: "فاصوليا", icon: "sprout" },
];

const REGIONS = [
  "Marrakech", "Fès", "Casablanca", "Agadir", "Meknès",
  "Oujda", "Beni Mellal", "Errachidia", "Souss-Massa",
  "Drâa-Tafilalet", "Tanger", "Rabat",
];

const REGIONS_AR = {
  "Marrakech": "مراكش", "Fès": "فاس", "Casablanca": "الدار البيضاء",
  "Agadir": "أكادير", "Meknès": "مكناس", "Oujda": "وجدة",
  "Beni Mellal": "بني ملال", "Errachidia": "الرشيدية",
  "Souss-Massa": "سوس ماسة", "Drâa-Tafilalet": "درعة تافيلالت",
  "Tanger": "طنجة", "Rabat": "الرباط",
};

const SOILS = [
  {
    key: "Sableux",
    fr: { label: "Sableux", desc: "Drainant, sec rapidement" },
    ar: { label: "رملي", desc: "ينضح بسرعة، يجف بسرعة" },
    icon: "sun",
  },
  {
    key: "Limoneux",
    fr: { label: "Limoneux", desc: "Équilibré, idéal pour la plupart des cultures" },
    ar: { label: "طمي", desc: "متوازن، مناسب لمعظم المحاصيل" },
    icon: "sprout",
  },
  {
    key: "Argileux",
    fr: { label: "Argileux", desc: "Retient l'eau longtemps" },
    ar: { label: "طيني", desc: "يحتفظ بالماء طويلاً" },
    icon: "droplet",
  },
];

const SYSTEMS = [
  {
    key: "drip",
    fr: { label: "Goutte-à-goutte", desc: "Économique en eau" },
    ar: { label: "بالتنقيط", desc: "اقتصادي في الماء" },
    icon: "droplet",
  },
  {
    key: "sprinkler",
    fr: { label: "Aspersion", desc: "Couvre une grande surface" },
    ar: { label: "بالرش", desc: "يغطي مساحة واسعة" },
    icon: "cloudRain",
  },
  {
    key: "surface",
    fr: { label: "Gravitaire", desc: "Méthode traditionnelle" },
    ar: { label: "بالغمر", desc: "طريقة تقليدية" },
    icon: "wind",
  },
];

export default function OnboardingPage() {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useAuth();
  const adding = sp.get("add") === "1";

  useEffect(() => {
    if (user === null) router.replace(`/${locale}/login?next=/onboarding`);
  }, [user, locale, router]);

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [crop, setCrop] = useState("");
  const [soil, setSoil] = useState("Limoneux");
  const [system, setSystem] = useState("drip");
  const [landSize, setLandSize] = useState("");
  const [emitterRate, setEmitterRate] = useState("4");
  const [plantingDate, setPlantingDate] = useState("");
  const [notify, setNotify] = useState(true);
  const [notifyTime, setNotifyTime] = useState("06:00");
  const [saving, setSaving] = useState(false);

  const stepsCount = 5;

  const canNext = useMemo(() => {
    if (step === 0) return Boolean(region);
    if (step === 1) return Boolean(crop);
    if (step === 2) return Boolean(soil);
    if (step === 3) return Boolean(system);
    return true;
  }, [step, region, crop, soil, system]);

  const next = () => setStep((s) => Math.min(s + 1, stepsCount - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    setSaving(true);
    try {
      savePlot({
        name: name || (ar ? `${CROPS.find((c) => c.name_fr === crop)?.name_ar || ""} – ${REGIONS_AR[region] || region}` : `${crop} – ${region}`),
        crop,
        region,
        soil,
        irrigationSystem: system,
        landSize: landSize ? Number(landSize) : null,
        emitterRate: system === "drip" && emitterRate ? Number(emitterRate) : null,
        plantingDate: plantingDate || null,
        notifications: notify,
        notifyTime,
      });
      markOnboarded();
      router.replace(`/${locale}/today`);
    } finally {
      setSaving(false);
    }
  };

  const t = {
    titles: ar
      ? ["منطقتك", "محصولك", "تربتك", "نظام الري", "التذكيرات"]
      : ["Votre région", "Votre culture", "Votre sol", "Système d'irrigation", "Rappels"],
    descs: ar
      ? [
          "اختر منطقتك. سنجلب توقعات الطقس الخاصة بها.",
          "ماذا تزرع في هذه القطعة؟",
          "نوع التربة يحدد سرعة احتفاظها بالماء.",
          "كيف تسقي حالياً؟",
          "نذكّرك مرة في اليوم. وقت يناسبك؟",
        ]
      : [
          "Choisissez votre région. Nous récupérons la météo locale.",
          "Que cultivez-vous sur cette parcelle ?",
          "Le type de sol détermine combien d'eau il retient.",
          "Comment arrosez-vous actuellement ?",
          "Un rappel par jour. À quelle heure ?",
        ],
    skip: ar ? "تجاوز" : "Passer",
    back: ar ? "رجوع" : "Retour",
    next: ar ? "التالي" : "Suivant",
    finish: ar ? "إنهاء" : "Terminer",
  };

  return (
    <div className="min-h-[100dvh] flex flex-col" style={{ background: "var(--gradient-sunrise)" }}>
      <TopBar
        transparent
        leading={
          step > 0 ? (
            <button
              type="button"
              onClick={back}
              aria-label={t.back}
              className="h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-muted)]"
            >
              <Icon name="arrowLeft" className="h-5 w-5 rtl-flip" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { markOnboarded(); router.replace(`/${locale}/today`); }}
              aria-label={t.skip}
              className="h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-muted)]"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          )
        }
        trailing={
          <button
            type="button"
            onClick={() => { markOnboarded(); router.replace(`/${locale}/today`); }}
            className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] px-3"
          >
            {t.skip}
          </button>
        }
      />

      <div className="flex-1 flex flex-col">
        <div className="page-container pt-2 pb-3">
          <Stepper steps={stepsCount} current={step} />
        </div>

        <div className="flex-1 page-container py-4">
          <div className="max-w-md mx-auto">
            <h1 className="display text-3xl sm:text-4xl text-[var(--color-text-strong)] mt-2">
              {t.titles[step]}
            </h1>
            <p className="text-[15px] text-[var(--color-text-muted)] mt-2 mb-6">
              {t.descs[step]}
            </p>

            {step === 0 && (
              <Card padding="md">
                <Select
                  label={ar ? "المنطقة" : "Région"}
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder={ar ? "اختر منطقة..." : "Choisir une région…"}
                  options={REGIONS.map((r) => ({
                    value: r,
                    label: ar ? `${REGIONS_AR[r] || r}` : r,
                  }))}
                />
                <div className="mt-4">
                  <Input
                    label={ar ? "اسم القطعة (اختياري)" : "Nom de la parcelle (optionnel)"}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={ar ? "مثال: قطعة الزيتون" : "Ex. Parcelle des oliviers"}
                  />
                </div>
              </Card>
            )}

            {step === 1 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {CROPS.map((c) => {
                  const selected = crop === c.name_fr;
                  return (
                    <button
                      key={c.name_fr}
                      type="button"
                      onClick={() => setCrop(c.name_fr)}
                      className={cn(
                        "flex flex-col items-center justify-center text-center p-4 rounded-2xl border transition-all duration-150",
                        selected
                          ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)] shadow-[var(--shadow-2)]"
                          : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-strong)] hover:border-[var(--color-primary-300)] active:scale-[.98]"
                      )}
                    >
                      <Icon name={c.icon} className="h-7 w-7 mb-1.5" />
                      <span className="text-[13px] font-medium">
                        {ar ? c.name_ar : c.name_fr}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-2.5">
                {SOILS.map((s) => {
                  const selected = soil === s.key;
                  const meta = ar ? s.ar : s.fr;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSoil(s.key)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border text-left rtl:text-right transition-all duration-150",
                        selected
                          ? "bg-[var(--color-primary-100)] border-[var(--color-primary-500)]"
                          : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
                      )}
                    >
                      <span
                        className={cn(
                          "h-12 w-12 shrink-0 rounded-2xl inline-flex items-center justify-center",
                          selected
                            ? "bg-[var(--color-primary-600)] text-white"
                            : "bg-[var(--color-surface-sunken)] text-[var(--color-text-strong)]"
                        )}
                      >
                        <Icon name={s.icon} className="h-6 w-6" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-[var(--color-text-strong)]">{meta.label}</p>
                        <p className="text-sm text-[var(--color-text-muted)]">{meta.desc}</p>
                      </div>
                      {selected && (
                        <Icon name="check" className="h-5 w-5 text-[var(--color-primary-700)] shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2.5">
                  {SYSTEMS.map((s) => {
                    const selected = system === s.key;
                    const meta = ar ? s.ar : s.fr;
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setSystem(s.key)}
                        className={cn(
                          "w-full flex items-center gap-4 p-4 rounded-2xl border text-left rtl:text-right transition-all duration-150",
                          selected
                            ? "bg-[var(--color-primary-100)] border-[var(--color-primary-500)]"
                            : "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary-300)]"
                        )}
                      >
                        <span
                          className={cn(
                            "h-12 w-12 shrink-0 rounded-2xl inline-flex items-center justify-center",
                            selected
                              ? "bg-[var(--color-primary-600)] text-white"
                              : "bg-[var(--color-surface-sunken)] text-[var(--color-text-strong)]"
                          )}
                        >
                          <Icon name={s.icon} className="h-6 w-6" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold text-[var(--color-text-strong)]">{meta.label}</p>
                          <p className="text-sm text-[var(--color-text-muted)]">{meta.desc}</p>
                        </div>
                        {selected && (
                          <Icon name="check" className="h-5 w-5 text-[var(--color-primary-700)] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <Card padding="md" surface="sunken">
                  <h4 className="text-sm font-semibold text-[var(--color-text-strong)] mb-3">
                    {ar ? "تفاصيل اختيارية" : "Détails (optionnel)"}
                  </h4>
                  <p className="text-xs text-[var(--color-text-muted)] mb-4">
                    {ar
                      ? "تساعدنا على إعطائك حسابات دقيقة بالليتر ومدة التشغيل."
                      : "Permettent de calculer les litres exacts et la durée d'arrosage."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      type="number"
                      label={ar ? "المساحة (م²)" : "Surface (m²)"}
                      value={landSize}
                      onChange={(e) => setLandSize(e.target.value)}
                      placeholder="1000"
                      min="0"
                    />
                    {system === "drip" && (
                      <Input
                        type="number"
                        label={ar ? "تدفق المنقّط (ل/س)" : "Débit goutteur (L/h)"}
                        value={emitterRate}
                        onChange={(e) => setEmitterRate(e.target.value)}
                        placeholder="4"
                        min="0"
                        step="0.1"
                      />
                    )}
                    <Input
                      type="date"
                      label={ar ? "تاريخ الزرع" : "Date de plantation"}
                      value={plantingDate}
                      onChange={(e) => setPlantingDate(e.target.value)}
                      className={system === "drip" ? "sm:col-span-2" : ""}
                    />
                  </div>
                </Card>
              </div>
            )}

            {step === 4 && (
              <Card padding="md" className="space-y-5">
                <Switch
                  label={ar ? "تذكير يومي" : "Rappel quotidien"}
                  description={
                    ar
                      ? "إشعار قصير كل صباح مع كمية الري المقترحة."
                      : "Une notification courte chaque matin avec la dose recommandée."
                  }
                  checked={notify}
                  onChange={setNotify}
                />
                {notify && (
                  <Input
                    type="time"
                    label={ar ? "الوقت المفضل" : "Heure du rappel"}
                    value={notifyTime}
                    onChange={(e) => setNotifyTime(e.target.value)}
                  />
                )}

                <div className="rounded-xl bg-[var(--color-surface-sunken)] p-4 text-sm text-[var(--color-text-muted)]">
                  {ar
                    ? "يمكنك تغيير هذه الإعدادات لاحقاً من ملفك الشخصي."
                    : "Vous pourrez modifier ces préférences plus tard depuis votre profil."}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Sticky CTA bar */}
        <div
          className="sticky bottom-0 bg-[var(--color-bg)]/95 backdrop-blur-md border-t border-[var(--color-border)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="page-container py-3 max-w-md mx-auto">
            {step < stepsCount - 1 ? (
              <Button
                onClick={next}
                disabled={!canNext}
                size="xl"
                trailingIcon="arrowRight"
                fullWidth
              >
                {t.next}
              </Button>
            ) : (
              <Button
                onClick={finish}
                loading={saving}
                size="xl"
                leadingIcon="check"
                fullWidth
                variant="primary"
              >
                {t.finish}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
