"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Badge,
  Banner,
  Button,
  Card,
  Input,
  Textarea,
  ToastProvider,
  useToast,
} from "@/components/ui";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import { createAPIClient } from "@/lib/api";

const SUBJECT_PRESETS = {
  fr: {
    "delete-account": "Demande de suppression de compte",
    "support": "Support technique",
    "partnership": "Partenariat / coopérative",
    "feedback": "Suggestion / retour",
    "bug": "Signaler un bug",
  },
  ar: {
    "delete-account": "طلب حذف الحساب",
    "support": "دعم تقني",
    "partnership": "شراكة / تعاونية",
    "feedback": "اقتراح / ملاحظة",
    "bug": "الإبلاغ عن خلل",
  },
};

export default function ContactPage() {
  return (
    <ToastProvider>
      <ContactInner />
    </ToastProvider>
  );
}

function ContactInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const sp = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Pre-fill from auth + ?subject= deep-links
  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "");
      setEmail(user.email || "");
    }
    const preset = sp.get("subject");
    if (preset && SUBJECT_PRESETS[ar ? "ar" : "fr"][preset]) {
      setSubject(SUBJECT_PRESETS[ar ? "ar" : "fr"][preset]);
    }
  }, [user, sp, ar]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const client = createAPIClient();
      const res = await client.submitContact({
        full_name: fullName,
        email,
        subject,
        message,
      });
      if (res.success) {
        setSuccess(true);
        toast.push({
          tone: "success",
          title: ar ? "تم إرسال رسالتك" : "Message envoyé",
          description: ar ? "نعود إليك خلال 48 ساعة." : "Nous revenons vers vous sous 48 h.",
        });
        setSubject("");
        setMessage("");
      } else {
        toast.push({ tone: "danger", title: res.message || "Erreur" });
      }
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container py-6 sm:py-10 max-w-3xl">
      <header className="mb-6">
        <Badge variant="accent" icon="mail">
          {ar ? "تواصل" : "Nous écrire"}
        </Badge>
        <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
          {ar ? "كيف يمكننا مساعدتك؟" : "Comment pouvons-nous aider ?"}
        </h1>
        <p className="mt-2 text-[15px] text-[var(--color-text-muted)] max-w-xl leading-relaxed">
          {ar
            ? "نقرأ كل رسالة. نرد عادة خلال 48 ساعة في أيام العمل."
            : "Nous lisons chaque message. Réponse habituelle sous 48 h (jours ouvrés)."}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* CONTACT CHANNELS */}
        <div className="lg:col-span-1 space-y-3">
          <Card surface="leaf" padding="md">
            <span className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[var(--color-primary-600)] text-white">
              <Icon name="send" className="h-5 w-5 rtl-flip" />
            </span>
            <h3 className="mt-4 text-[15px] font-semibold text-[var(--color-text-strong)]">
              {ar ? "اسأل الاستشاري" : "Chat agronome"}
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {ar
                ? "للأسئلة الزراعية، استخدم الاستشاري داخل التطبيق."
                : "Pour les questions agricoles, utilisez le conseiller dans l'app."}
            </p>
          </Card>
          <Card padding="md">
            <span className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[var(--color-surface-sunken)] text-[var(--color-text-strong)]">
              <Icon name="inbox" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-[15px] font-semibold text-[var(--color-text-strong)]">Email</h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1 break-all">
              hello@saqi.ma
            </p>
          </Card>
          <Card padding="md">
            <span className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[var(--color-surface-sunken)] text-[var(--color-text-strong)]">
              <Icon name="info" className="h-5 w-5" />
            </span>
            <h3 className="mt-4 text-[15px] font-semibold text-[var(--color-text-strong)]">FAQ</h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {ar
                ? "ربما الإجابة موجودة بالفعل."
                : "La réponse est peut-être déjà là."}
            </p>
            <Link
              href={`/${locale}/faq`}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary-700)] hover:underline"
            >
              {ar ? "زيارة الأسئلة" : "Voir la FAQ"}
              <Icon name="arrowRight" className="h-3.5 w-3.5 rtl-flip" />
            </Link>
          </Card>
        </div>

        {/* FORM */}
        <Card padding="lg" className="lg:col-span-2">
          {success ? (
            <div className="text-center py-10">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-success-bg)] text-[var(--color-success)] mb-5">
                <Icon name="checkCircle" className="h-8 w-8" />
              </span>
              <h3 className="text-xl font-semibold text-[var(--color-text-strong)]">
                {ar ? "وصلتنا رسالتك" : "Message bien reçu"}
              </h3>
              <p className="mt-2 text-[15px] text-[var(--color-text-muted)] max-w-md mx-auto">
                {ar
                  ? "شكراً لك. نعود إليك بأقرب وقت ممكن."
                  : "Merci. Nous vous répondrons dès que possible."}
              </p>
              <div className="mt-6">
                <Button onClick={() => setSuccess(false)} variant="secondary" leadingIcon="edit">
                  {ar ? "إرسال رسالة أخرى" : "Envoyer un autre message"}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={ar ? "الاسم الكامل" : "Nom complet"}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  leadingIcon="user"
                  autoComplete="name"
                  placeholder="Ahmed Benali"
                />
                <Input
                  type="email"
                  label={ar ? "البريد الإلكتروني" : "Email"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  leadingIcon="mail"
                  autoComplete="email"
                  placeholder="vous@example.com"
                />
              </div>
              <Input
                label={ar ? "الموضوع" : "Sujet"}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                placeholder={ar ? "موضوع الرسالة" : "Objet de votre message"}
              />
              <Textarea
                label={ar ? "الرسالة" : "Message"}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={6}
                placeholder={ar ? "اشرح طلبك بإيجاز..." : "Décrivez votre demande en quelques lignes…"}
              />

              <div className="pt-2">
                <Button type="submit" loading={loading} size="lg" leadingIcon="send" fullWidth>
                  {ar ? "إرسال" : "Envoyer le message"}
                </Button>
                <p className="mt-3 text-xs text-[var(--color-text-muted)] text-center">
                  {ar
                    ? "بالإرسال، أنت توافق على معالجة بياناتك حسب سياسة الخصوصية."
                    : "En envoyant, vous acceptez le traitement de vos données selon notre politique de confidentialité."}
                </p>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
