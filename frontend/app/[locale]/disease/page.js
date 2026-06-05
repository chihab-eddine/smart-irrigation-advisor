"use client";

import { useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "@/components/Icon";
import CameraCapture from "@/components/CameraCapture";
import { useAuth } from "@/components/AuthProvider";
import { createAPIClient } from "@/lib/api";
import { pickImage, USE_WEB_CAMERA } from "@/lib/camera";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Progress,
  Select,
  Skeleton,
  Spinner,
  ToastProvider,
  cn,
} from "@/components/ui";

const LOW_CONFIDENCE = 0.5;

const CROPS = [
  { value: "",        fr: "Détection automatique", ar: "اكتشاف تلقائي" },
  { value: "Apple",   fr: "Pommier",   ar: "تفاح" },
  { value: "Cherry",  fr: "Cerisier",  ar: "كرز" },
  { value: "Corn",    fr: "Maïs",      ar: "ذرة" },
  { value: "Grape",   fr: "Vigne",     ar: "عنب" },
  { value: "Orange",  fr: "Oranger",   ar: "برتقال" },
  { value: "Peach",   fr: "Pêcher",    ar: "خوخ" },
  { value: "Pepper",  fr: "Poivron",   ar: "فلفل" },
  { value: "Potato",  fr: "Pomme de terre", ar: "بطاطس" },
  { value: "Strawberry", fr: "Fraisier", ar: "فراولة" },
  { value: "Tomato",  fr: "Tomate",    ar: "طماطم" },
];

export default function DiseasePage() {
  return (
    <ToastProvider>
      <DiseaseInner />
    </ToastProvider>
  );
}

function DiseaseInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const router = useRouter();
  const { user, accessToken } = useAuth();

  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cropType, setCropType] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const inputRef = useRef(null);

  // Gemini-generated personalised tips for the diagnosed disease
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiError, setAiError] = useState("");

  const acceptFile = (f) => {
    if (!f) return;
    if (!f.type?.startsWith("image/")) {
      setError(ar ? "اختر صورة صالحة." : "Sélectionnez une image valide.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError(ar ? "حجم الصورة كبير (8MB كحد أقصى)." : "Image trop lourde (max 8 Mo).");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError("");
    setResult(null);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    acceptFile(e.dataTransfer?.files?.[0]);
  };

  const handlePick = async (source) => {
    setError("");
    try {
      const res = await pickImage({ fallbackInput: inputRef.current, source });
      if (res === USE_WEB_CAMERA) setCameraOpen(true);
      else if (res) acceptFile(res);
    } catch (e) {
      setError(e?.message || (ar ? "تعذّر فتح الكاميرا." : "Impossible d'ouvrir la caméra."));
    }
  };

  const analyze = async () => {
    if (!file) return;
    if (!accessToken) {
      setError(
        ar ? "سجّل دخولك لتشخيص الصورة." : "Connectez-vous pour analyser l'image."
      );
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setAiText("");
    setAiError("");
    try {
      const client = createAPIClient(accessToken);
      const fd = new FormData();
      fd.append("image", file);
      fd.append("locale", locale);
      if (cropType) fd.append("crop_type", cropType);
      const diag = await client.predictDisease(fd);
      if (diag) {
        setResult(diag);
        // Kick the Gemini tips in the background — don't block the result.
        fetchAi(client, diag);
      } else {
        setError(ar ? "تعذر تحليل الصورة." : "Analyse impossible.");
      }
    } catch (e) {
      setError(e?.message || (ar ? "تعذر تحليل الصورة." : "Analyse impossible."));
    } finally {
      setLoading(false);
    }
  };

  const fetchAi = async (client, diag) => {
    setAiLoading(true);
    setAiError("");
    try {
      const res = await client.aiDiseaseTips({
        disease_key: diag.disease_key || "",
        disease_name:
          (ar ? diag.disease_name_ar : diag.disease_name_fr) ||
          diag.disease_name ||
          diag.disease_key ||
          "",
        confidence_score: Number(diag.confidence_score || 0),
        crop_type: cropType || diag.crop_type || "",
        treatment:
          (ar ? diag.treatment_ar : diag.treatment_fr) || diag.treatment || "",
        locale,
      });
      setAiText(res?.text || "");
    } catch (e) {
      const msg = String(e?.message || "");
      if (e?.status === 503 || msg.toLowerCase().includes("gemini")) {
        setAiError("not_configured");
      } else {
        setAiError(msg || (ar ? "تعذر توليد النصيحة." : "Conseil IA indisponible."));
      }
    } finally {
      setAiLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setCropType("");
    setResult(null);
    setError("");
    setAiText("");
    setAiError("");
  };

  const lowConf = Boolean(
    result && (result.uncertain === true || Number(result.confidence_score || 0) < LOW_CONFIDENCE)
  );
  const healthy = result?.disease_key?.toLowerCase?.()?.includes("healthy");
  const confidencePct = result ? Math.round((result.confidence_score || 0) * 100) : 0;

  return (
    <div className="page-container py-6 sm:py-10 max-w-3xl">
      <header className="mb-6">
        <Badge variant="primary" icon="leaf">
          {ar ? "صحة النباتات" : "Santé des plantes"}
        </Badge>
        <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
          {ar ? "ورقة تبدو مريضة؟" : "Une feuille suspecte ?"}
        </h1>
        <p className="mt-2 text-[15px] text-[var(--color-text-muted)] max-w-xl">
          {ar
            ? "صوّر ورقة واحدة بإضاءة طبيعية. ستحصل على تشخيص وخطوات علاج عملية."
            : "Photographiez une seule feuille en lumière naturelle. Diagnostic et conseils en quelques secondes."}
        </p>
      </header>

      {!user && (
        <Banner tone="info" title={ar ? "الدخول مطلوب" : "Connexion requise"}>
          <span>
            {ar ? "سجّل الدخول لتشخيص الصور." : "Connectez-vous pour analyser une image."}{" "}
          </span>
          <Link href={`/${locale}/login?next=/disease`} className="font-semibold text-[var(--color-primary-700)] hover:underline">
            {ar ? "تسجيل الدخول" : "Se connecter"}
          </Link>
        </Banner>
      )}

      {/* Upload zone */}
      {!preview ? (
        <Card padding="lg" surface="raised">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={cn(
              "relative rounded-2xl border-2 border-dashed transition-all duration-200",
              "px-6 py-12 sm:py-16 text-center",
              dragActive
                ? "border-[var(--color-primary-500)] bg-[var(--color-primary-100)]/40"
                : "border-[var(--color-border-strong)] bg-[var(--color-surface-muted)]/60"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => acceptFile(e.target.files?.[0])}
              aria-label={ar ? "اختر صورة" : "Choisir une image"}
            />
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary-100)] text-[var(--color-primary-700)] mb-4">
              <Icon name="image" className="h-8 w-8" />
            </span>
            <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">
              {ar ? "أضف صورة الورقة" : "Ajoutez une photo de feuille"}
            </h3>
            <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
              {ar
                ? "اسحب الصورة هنا، أو استخدم الكاميرا."
                : "Glissez une image ici, ou utilisez la caméra."}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-subtle)]">JPG · PNG · 8 MB max</p>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              onClick={() => handlePick("camera")}
              size="lg"
              leadingIcon="image"
              fullWidth
            >
              {ar ? "فتح الكاميرا" : "Ouvrir la caméra"}
            </Button>
            <Button
              type="button"
              onClick={() => handlePick("gallery")}
              size="lg"
              variant="secondary"
              leadingIcon="upload"
              fullWidth
            >
              {ar ? "من المعرض" : "Depuis la galerie"}
            </Button>
          </div>

          {error && (
            <div className="mt-4">
              <Banner tone="danger" title={ar ? "خطأ" : "Erreur"}>
                {error}
              </Banner>
            </div>
          )}
        </Card>
      ) : (
        <Card padding="lg" surface="raised">
          {/* Preview */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-[var(--color-surface-sunken)] flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <button
              type="button"
              onClick={reset}
              aria-label={ar ? "إزالة" : "Retirer"}
              className="absolute top-3 right-3 rtl:right-auto rtl:left-3 h-9 w-9 inline-flex items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/70"
            >
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5">
            <Select
              label={ar ? "نوع المحصول (اختياري)" : "Type de culture (optionnel)"}
              value={cropType}
              onChange={(e) => setCropType(e.target.value)}
              options={CROPS.map((c) => ({ value: c.value, label: ar ? c.ar : c.fr }))}
              hint={
                ar
                  ? "إن لم تكن متأكداً، اتركها على الاكتشاف التلقائي."
                  : "En cas de doute, laissez sur détection automatique."
              }
            />
          </div>

          <div className="mt-5">
            <Button
              onClick={analyze}
              loading={loading}
              size="lg"
              leadingIcon="check"
              fullWidth
              disabled={!user}
            >
              {ar ? "تشخيص الصورة" : "Diagnostiquer"}
            </Button>
          </div>

          {error && (
            <div className="mt-4">
              <Banner tone="danger" title={ar ? "خطأ" : "Erreur"}>
                {error}
              </Banner>
            </div>
          )}

          {loading && (
            <div className="mt-5 space-y-3">
              <Skeleton height={20} width="40%" />
              <Skeleton height={32} width="70%" />
              <Skeleton height={14} />
              <Skeleton height={14} width="80%" />
            </div>
          )}

          {result && !loading && (
            <ResultPanel
              result={result}
              ar={ar}
              lowConf={lowConf}
              healthy={healthy}
              confidencePct={confidencePct}
              onReset={reset}
              aiLoading={aiLoading}
              aiText={aiText}
              aiError={aiError}
            />
          )}
        </Card>
      )}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(f) => {
          setCameraOpen(false);
          acceptFile(f);
        }}
      />
    </div>
  );
}

function ResultPanel({ result, ar, lowConf, healthy, confidencePct, onReset, aiLoading, aiText, aiError }) {
  const name = (ar ? result.disease_name_ar : result.disease_name_fr) || result.disease_name || result.disease_key;
  const treatment = (ar ? result.treatment_ar : result.treatment_fr) || result.treatment;
  const description = (ar ? result.description_ar : result.description_fr) || result.description;

  return (
    <div className="mt-6 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          {healthy ? (
            <Badge variant="success" icon="checkCircle">
              {ar ? "نبات سليم" : "Plante saine"}
            </Badge>
          ) : lowConf ? (
            <Badge variant="warning" icon="alertCircle">
              {ar ? "ثقة منخفضة" : "Faible confiance"}
            </Badge>
          ) : (
            <Badge variant="primary" icon="checkCircle">
              {ar ? "تشخيص" : "Diagnostic"}
            </Badge>
          )}
        </div>
        <h2 className="display text-2xl sm:text-3xl text-[var(--color-text-strong)] mt-1">
          {name}
        </h2>
        <div className="mt-3">
          <Progress
            value={confidencePct}
            tone={healthy ? "success" : lowConf ? "warning" : "primary"}
            label={ar ? "مستوى الثقة" : "Niveau de confiance"}
            showValue
          />
        </div>
      </div>

      {lowConf && (
        <Banner tone="warning" title={ar ? "إعد التصوير" : "Refaites la photo"}>
          {ar
            ? "النموذج ليس متأكداً. جرب صورة أوضح، بإضاءة طبيعية وورقة واحدة في الإطار."
            : "Le modèle hésite. Réessayez avec une photo plus nette : une seule feuille, en lumière naturelle."}
        </Banner>
      )}

      {description && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            {ar ? "الوصف" : "Description"}
          </h3>
          <p className="mt-1.5 text-[15px] text-[var(--color-text)] leading-relaxed">{description}</p>
        </div>
      )}

      {treatment && (
        <div className="rounded-2xl bg-[var(--color-primary-100)]/50 border border-[var(--color-primary-200)] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-primary-700)]">
            {ar ? "ما العمل ؟" : "Que faire ?"}
          </h3>
          <p className="mt-2 text-[15px] text-[var(--color-text)] leading-relaxed whitespace-pre-line">
            {treatment}
          </p>
        </div>
      )}

      {/* === Gemini personalised tips === */}
      <AiTipsCard ar={ar} loading={aiLoading} text={aiText} error={aiError} />

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button onClick={onReset} variant="secondary" size="lg" leadingIcon="refresh">
          {ar ? "صورة أخرى" : "Une autre photo"}
        </Button>
      </div>

      {/* Trust disclaimer */}
      <div className="mt-4 rounded-xl bg-[var(--color-surface-sunken)] p-4 text-xs text-[var(--color-text-muted)] leading-relaxed">
        {ar
          ? "هذه أداة استشارية مبنية على نموذج مدرّب على أكثر من 54,000 صورة (PlantVillage). في حالة الشك، استشر فلاحاً ذا خبرة أو مرشد ORMVA المحلي."
          : "Cet outil est un conseil basé sur un modèle entraîné sur plus de 54 000 images (PlantVillage). En cas de doute, consultez un agriculteur expérimenté ou un conseiller ORMVA local."}
      </div>
    </div>
  );
}

function AiTipsCard({ ar, loading, text, error }) {
  // Hide silently if Gemini isn't configured on the backend (503)
  if (error === 'not_configured' && !text) return null;

  return (
    <div className="rounded-2xl bg-[var(--gradient-sky)] border border-[var(--color-accent-200)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-[var(--color-accent-500)] text-white">
          <Icon name="sprout" className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
            {ar ? 'نصيحة الاستشاري الذكي' : 'Conseil personnalisé'}
          </h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {ar ? 'مولّد لك من تشخيصك' : 'Généré à partir de votre diagnostic'}
          </p>
        </div>
        <Badge variant="accent" size="sm">AI</Badge>
      </div>
      {loading && (
        <div className="space-y-2">
          <Skeleton height={14} />
          <Skeleton height={14} />
          <Skeleton height={14} width="80%" />
        </div>
      )}
      {!loading && text && (
        <p className="text-[15px] text-[var(--color-text)] leading-relaxed whitespace-pre-line">
          {text}
        </p>
      )}
      {!loading && !text && error && error !== 'not_configured' && (
        <p className="text-sm text-[var(--color-text-muted)] italic">
          {ar
            ? 'تعذر توليد النصيحة الآن. أعد المحاولة بعد قليل.'
            : "Le conseil personnalisé n'est pas disponible pour le moment. Réessayez bientôt."}
        </p>
      )}
    </div>
  );
}

