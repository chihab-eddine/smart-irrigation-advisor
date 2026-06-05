"use client";

import { useLocale } from "next-intl";
import Link from "next/link";
import Icon from "@/components/Icon";

const CONTENT = {
  fr: {
    title: "Politique de confidentialité",
    updated: "Dernière mise à jour : mai 2026",
    back: "Retour à l'accueil",
    sections: [
      {
        title: "Données que nous collectons",
        body: "Nous collectons les informations nécessaires au fonctionnement du service : compte utilisateur, email, nom, analyses d'irrigation, diagnostics de maladies, préférences de notification, messages de contact et inscriptions newsletter.",
      },
      {
        title: "Images de diagnostic",
        body: "Les photos de feuilles envoyées pour diagnostic peuvent être stockées afin d'afficher l'historique de l'utilisateur. Elles sont associées au compte connecté et ne sont pas publiques.",
      },
      {
        title: "Utilisation des données",
        body: "Les données servent à générer des recommandations, afficher les historiques, améliorer l'expérience utilisateur, envoyer des notifications demandées et répondre aux messages de contact.",
      },
      {
        title: "Services tiers",
        body: "L'application peut utiliser Supabase pour l'authentification et la base de données, Open-Meteo pour la météo, un fournisseur email pour les notifications et un service d'IA pour certaines recommandations textuelles.",
      },
      {
        title: "Sécurité",
        body: "Les accès aux historiques sont protégés par authentification et politiques de sécurité côté base de données. Aucun système n'est parfaitement sécurisé, mais l'application limite l'accès aux données personnelles au compte concerné.",
      },
      {
        title: "Vos choix",
        body: "Vous pouvez gérer votre profil, vos préférences de notification et votre inscription newsletter. Pour toute demande liée à vos données, utilisez la page Contact.",
      },
    ],
  },
  ar: {
    title: "سياسة الخصوصية",
    updated: "آخر تحديث: ماي 2026",
    back: "العودة إلى الرئيسية",
    sections: [
      {
        title: "البيانات التي نجمعها",
        body: "نجمع البيانات الضرورية لتشغيل الخدمة: حساب المستخدم، البريد الإلكتروني، الاسم، تحاليل الري، تشخيصات الأمراض، تفضيلات الإشعارات، رسائل التواصل، والاشتراك في النشرة البريدية.",
      },
      {
        title: "صور التشخيص",
        body: "قد يتم تخزين صور أوراق النبات المرسلة للتشخيص لعرضها في سجل المستخدم. تكون مرتبطة بالحساب المتصل وليست عامة.",
      },
      {
        title: "استخدام البيانات",
        body: "تُستخدم البيانات لتوليد التوصيات، عرض السجل، تحسين تجربة المستخدم، إرسال الإشعارات المطلوبة، والرد على رسائل التواصل.",
      },
      {
        title: "خدمات خارجية",
        body: "قد يستخدم التطبيق Supabase للمصادقة وقاعدة البيانات، Open-Meteo للطقس، مزود بريد للإشعارات، وخدمة ذكاء اصطناعي لبعض التوصيات النصية.",
      },
      {
        title: "الأمان",
        body: "يتم حماية الوصول إلى السجلات عبر تسجيل الدخول وسياسات أمان في قاعدة البيانات. لا يوجد نظام آمن بالكامل، لكن التطبيق يحد الوصول إلى البيانات الشخصية للحساب المعني فقط.",
      },
      {
        title: "اختياراتك",
        body: "يمكنك إدارة ملفك الشخصي، تفضيلات الإشعارات، والاشتراك في النشرة البريدية. لأي طلب متعلق ببياناتك، استخدم صفحة التواصل.",
      },
    ],
  },
};

export default function PrivacyPage() {
  const locale = useLocale();
  const copy = CONTENT[locale] || CONTENT.fr;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-6">
          <Link
            href={`/${locale}`}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            <Icon name="arrowLeft" className="h-4 w-4 rtl-flip" />
            {copy.back}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{copy.title}</h1>
          <p className="mt-2 text-sm text-gray-500">{copy.updated}</p>

          <div className="mt-8 space-y-6">
            {copy.sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-base font-semibold text-gray-900">{section.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{section.body}</p>
              </section>
            ))}
          </div>
        </article>
      </main>
    </div>
  );
}
