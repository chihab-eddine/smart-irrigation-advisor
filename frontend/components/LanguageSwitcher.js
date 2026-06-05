"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import Icon from "./Icon";

export default function LanguageSwitcher({ compact = false }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const toggleLanguage = () => {
    const next = locale === "fr" ? "ar" : "fr";
    const newPath = pathname.replace(/^\/(fr|ar)/, `/${next}`);
    router.push(newPath);
    router.refresh();
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleLanguage}
        aria-label={locale === "fr" ? "العربية" : "Français"}
        title={locale === "fr" ? "العربية" : "Français"}
        className="h-10 w-10 inline-flex items-center justify-center rounded-full text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)] transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
      >
        <Icon name="languages" className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="inline-flex items-center gap-2 h-10 px-3.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)] transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
      title={locale === "fr" ? "العربية" : "Français"}
    >
      <Icon name="languages" className="h-4 w-4 text-[var(--color-text-muted)]" />
      <span>{locale === "fr" ? "العربية" : "Français"}</span>
    </button>
  );
}
