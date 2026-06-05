"use client";

import { useLocale } from "next-intl";
import Link from "next/link";
import Icon from "@/components/Icon";

const CONTENT = {
  fr: {
    title: "FAQ",
    subtitle: "Réponses aux questions fréquentes sur l'irrigation, les diagnostics et le compte utilisateur.",
    back: "Retour à l'accueil",
    items: [
      {
        q: "Comment les recommandations d'irrigation sont-elles calculées ?",
        a: "L'application combine les données météo, la culture, le type de sol, la région et la date de plantation afin d'estimer le besoin quotidien en eau.",
      },
      {
        q: "Chaque analyse d'irrigation est-elle sauvegardée ?",
        a: "Oui. Chaque calcul lancé par un utilisateur connecté est enregistré dans son historique afin de suivre la même plantation jour après jour.",
      },
      {
        q: "Comment sont regroupées les plantations ?",
        a: "Les analyses sont regroupées par culture, région, type de sol et date de plantation. Cela permet de suivre séparément plusieurs parcelles ou cultures.",
      },
      {
        q: "Le diagnostic des maladies est-il définitif ?",
        a: "Non. Le diagnostic propose l'hypothèse la plus proche trouvée par le modèle. Il doit être confirmé par l'observation terrain ou par un expert agricole en cas de doute.",
      },
      {
        q: "Pourquoi choisir le type de plante avant l'analyse maladie ?",
        a: "Indiquer la plante réduit les confusions entre cultures différentes et améliore la pertinence de l'hypothèse proposée.",
      },
      {
        q: "Les recommandations intelligentes sont-elles générées plusieurs fois ?",
        a: "Non. Les recommandations sont mises en cache côté interface, et les recommandations quotidiennes d'irrigation sont prévues pour être sauvegardées une fois par jour par calcul.",
      },
      {
        q: "Puis-je utiliser l'application sans connexion ?",
        a: "Les pages publiques sont accessibles sans compte. Les analyses, historiques et préférences nécessitent une connexion.",
      },
    ],
  },
  ar: {
    title: "الأسئلة الشائعة",
    subtitle: "إجابات حول الري، تشخيص الأمراض، وحساب المستخدم.",
    back: "العودة إلى الرئيسية",
    items: [
      {
        q: "كيف يتم حساب توصيات الري؟",
        a: "يجمع التطبيق بين بيانات الطقس، المحصول، نوع التربة، المنطقة، وتاريخ الزراعة لتقدير الحاجة اليومية للماء.",
      },
      {
        q: "هل يتم حفظ كل تحليل ري؟",
        a: "نعم. كل تحليل يقوم به مستخدم متصل يتم حفظه في السجل حتى يمكن متابعة نفس المزروع يومًا بعد يوم.",
      },
      {
        q: "كيف يتم تجميع المزروعات؟",
        a: "يتم التجميع حسب المحصول، المنطقة، نوع التربة، وتاريخ الزراعة. هذا يسمح بمتابعة عدة قطع أو محاصيل بشكل منفصل.",
      },
      {
        q: "هل تشخيص أمراض النبات نهائي؟",
        a: "لا. التشخيص يعرض أقرب فرضية وجدها النموذج. يجب تأكيدها بالملاحظة الميدانية أو باستشارة خبير زراعي عند الشك.",
      },
      {
        q: "لماذا أختار نوع النبات قبل تحليل المرض؟",
        a: "اختيار النبات يقلل الخلط بين المحاصيل المختلفة ويحسن ملاءمة الفرضية المقترحة.",
      },
      {
        q: "هل يتم توليد التوصيات الذكية عدة مرات؟",
        a: "لا. يتم تخزين التوصيات مؤقتًا في الواجهة، وتوصيات الري اليومية مصممة للحفظ مرة واحدة يوميًا لكل تحليل.",
      },
      {
        q: "هل يمكن استعمال التطبيق بدون حساب؟",
        a: "الصفحات العامة متاحة بدون حساب. أما التحاليل، السجل، والتفضيلات فتحتاج إلى تسجيل الدخول.",
      },
    ],
  },
};

export default function FAQPage() {
  const locale = useLocale();
  const copy = CONTENT[locale] || CONTENT.fr;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href={`/${locale}`}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            <Icon name="arrowLeft" className="h-4 w-4 rtl-flip" />
            {copy.back}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{copy.title}</h1>
          <p className="mt-2 text-sm text-gray-600">{copy.subtitle}</p>

          <div className="mt-8 space-y-3">
            {copy.items.map((item) => (
              <section key={item.q} className="rounded-lg border border-gray-200 bg-white p-5">
                <h2 className="text-base font-semibold text-gray-900">{item.q}</h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.a}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
