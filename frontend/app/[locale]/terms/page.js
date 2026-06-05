"use client";

import { useLocale } from "next-intl";
import Link from "next/link";
import Icon from "@/components/Icon";

const CONTENT = {
  fr: {
    title: "Conditions d'utilisation",
    updated: "Dernière mise à jour : mai 2026",
    back: "Retour à l'accueil",
    sections: [
      {
        title: "Objet du service",
        body: "Smart Irrigation Advisor fournit des outils d'aide à la décision agricole : recommandations d'irrigation, suivi des analyses, diagnostics indicatifs de maladies et conseils complémentaires.",
      },
      {
        title: "Pas de garantie agronomique",
        body: "Les résultats sont fournis à titre d'aide. Ils ne remplacent pas l'observation terrain, l'avis d'un agronome, ni les recommandations officielles applicables à votre région ou culture.",
      },
      {
        title: "Responsabilité de l'utilisateur",
        body: "L'utilisateur reste responsable des décisions prises sur sa parcelle, notamment les doses d'eau appliquées, traitements phytosanitaires, pratiques culturales et vérifications réglementaires.",
      },
      {
        title: "Compte et sécurité",
        body: "Vous devez protéger vos identifiants et utiliser des informations exactes. Toute activité effectuée depuis votre compte peut être associée à votre profil utilisateur.",
      },
      {
        title: "Usage acceptable",
        body: "Il est interdit d'utiliser le service pour accéder aux données d'autres utilisateurs, perturber l'application, envoyer du contenu illégal ou détourner les fonctionnalités.",
      },
      {
        title: "Évolution du service",
        body: "Les fonctionnalités peuvent évoluer, être corrigées ou suspendues. Les présentes conditions peuvent être mises à jour afin de refléter ces changements.",
      },
    ],
  },
  ar: {
    title: "شروط الاستخدام",
    updated: "آخر تحديث: ماي 2026",
    back: "العودة إلى الرئيسية",
    sections: [
      {
        title: "هدف الخدمة",
        body: "يوفر Smart Irrigation Advisor أدوات لمساعدة القرار الزراعي: توصيات الري، متابعة التحاليل، تشخيصات إرشادية للأمراض، ونصائح إضافية.",
      },
      {
        title: "لا توجد ضمانة زراعية نهائية",
        body: "النتائج مقدمة كوسيلة مساعدة فقط. لا تعوض الملاحظة الميدانية، رأي مهندس زراعي، أو التوصيات الرسمية الخاصة بمنطقتك أو محصولك.",
      },
      {
        title: "مسؤولية المستخدم",
        body: "يبقى المستخدم مسؤولاً عن القرارات المتخذة في قطعته، بما في ذلك كميات الماء، المعالجات النباتية، الممارسات الزراعية، والتحقق من المتطلبات القانونية.",
      },
      {
        title: "الحساب والأمان",
        body: "يجب حماية بيانات الدخول واستعمال معلومات صحيحة. أي نشاط يتم من حسابك يمكن ربطه بملفك كمستخدم.",
      },
      {
        title: "الاستخدام المقبول",
        body: "يُمنع استخدام الخدمة للوصول إلى بيانات مستخدمين آخرين، تعطيل التطبيق، إرسال محتوى غير قانوني، أو إساءة استعمال الوظائف.",
      },
      {
        title: "تطور الخدمة",
        body: "قد تتغير الميزات أو يتم تصحيحها أو تعليقها. يمكن تحديث هذه الشروط لتعكس هذه التغييرات.",
      },
    ],
  },
};

export default function TermsPage() {
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
