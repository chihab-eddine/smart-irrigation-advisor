"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import Icon from "./Icon";
import { useAuth } from "./AuthProvider";
import { Avatar, ThemeToggle, cn } from "./ui";
import { signOutAndRedirect } from "@/lib/auth-actions";

export default function Navbar({ variant = "marketing" }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const { user, profile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "";

  const handleLogout = async () => {
    await signOutAndRedirect({ locale, to: "/login" });
  };

  const links = user
    ? [
        { name: t("dashboard"), href: `/${locale}/dashboard` },
        { name: locale === "ar" ? "اليوم" : "Aujourd'hui", href: `/${locale}/today` },
        { name: t("irrigation"), href: `/${locale}/irrigation` },
        { name: t("disease"), href: `/${locale}/disease` },
      ]
    : [
        { name: locale === "ar" ? "المنتج" : "Produit", href: `/${locale}#features` },
        { name: locale === "ar" ? "كيف يعمل" : "Comment ça marche", href: `/${locale}#how` },
        { name: t("blog"), href: `/${locale}/blog` },
        { name: t("contact"), href: `/${locale}/contact` },
      ];

  const isActive = (href) =>
    pathname === href || (href !== `/${locale}` && pathname?.startsWith(href));

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors",
        "bg-[var(--color-surface)]/85 backdrop-blur-md border-b border-[var(--color-border)]"
      )}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="page-container">
        <div className="flex items-center justify-between h-16">
          {/* Logo + desktop nav */}
          <div className="flex items-center gap-8">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2.5 group"
              aria-label="Saqi"
            >
              <span
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-xl",
                  "bg-[var(--color-primary-600)] text-white shadow-[var(--shadow-1)]",
                  "transition-transform duration-200 group-hover:scale-105"
                )}
              >
                <Icon name="droplet" className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="hidden sm:flex flex-col leading-none">
                <span className="text-[17px] font-semibold text-[var(--color-text-strong)] tracking-tight">
                  Saqi
                </span>
                <span className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {locale === "ar" ? "ساقي" : "Conseiller agricole"}
                </span>
              </span>
            </Link>

            <nav className="hidden lg:flex items-center gap-0.5">
              {links.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={cn(
                    "px-3.5 h-9 inline-flex items-center rounded-full text-sm font-medium transition-colors",
                    isActive(link.href)
                      ? "bg-[var(--color-surface-sunken)] text-[var(--color-text-strong)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)]"
                  )}
                >
                  {link.name}
                </Link>
              ))}
              {profile?.role === "admin" && (
                <Link
                  href={`/${locale}/admin`}
                  className={cn(
                    "px-3.5 h-9 inline-flex items-center rounded-full text-sm font-medium transition-colors",
                    isActive(`/${locale}/admin`)
                      ? "bg-[var(--color-surface-sunken)] text-[var(--color-text-strong)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)]"
                  )}
                >
                  {t("admin")}
                </Link>
              )}
            </nav>
          </div>

          {/* Right: language + theme + auth */}
          <div className="flex items-center gap-1.5">
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            <ThemeToggle compact />

            <div className="hidden lg:flex items-center gap-2 ms-1">
              {user ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className={cn(
                      "inline-flex items-center gap-2 h-10 ps-1.5 pe-3 rounded-full",
                      "border border-[var(--color-border)] bg-[var(--color-surface)]",
                      "text-sm font-medium text-[var(--color-text-strong)]",
                      "hover:bg-[var(--color-surface-muted)] transition-colors",
                      "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                    )}
                  >
                    <Avatar name={displayName} size="xs" />
                    <span className="max-w-32 truncate" title={displayName}>
                      {displayName}
                    </span>
                    <Icon name="chevronDown" className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  </button>

                  {dropdownOpen && (
                    <>
                      <button
                        type="button"
                        aria-hidden="true"
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setDropdownOpen(false)}
                      />
                      <div
                        className={cn(
                          "absolute end-0 mt-2 w-56 rounded-2xl z-40 py-1.5",
                          "bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-3)]",
                          "animate-slide-down origin-top-right"
                        )}
                      >
                        <Link
                          href={`/${locale}/today`}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)]"
                        >
                          <Icon name="sun" className="h-4 w-4 text-[var(--color-text-muted)]" />
                          {locale === "ar" ? "اليوم" : "Aujourd'hui"}
                        </Link>
                        <Link
                          href={`/${locale}/profile`}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)]"
                        >
                          <Icon name="user" className="h-4 w-4 text-[var(--color-text-muted)]" />
                          {t("profile")}
                        </Link>
                        <Link
                          href={`/${locale}/dashboard`}
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)]"
                        >
                          <Icon name="dashboard" className="h-4 w-4 text-[var(--color-text-muted)]" />
                          {t("dashboard")}
                        </Link>
                        <div className="my-1 h-px bg-[var(--color-border-subtle)]" />
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full text-left rtl:text-right flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
                        >
                          <Icon name="logout" className="h-4 w-4 rtl-flip" />
                          {t("logout")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    href={`/${locale}/login`}
                    className="inline-flex items-center h-10 px-4 rounded-full text-sm font-medium text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)] transition-colors"
                  >
                    {t("login")}
                  </Link>
                  <Link
                    href={`/${locale}/register`}
                    className={cn(
                      "inline-flex items-center h-10 px-4 rounded-full text-sm font-medium",
                      "bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]",
                      "shadow-[var(--shadow-1)] transition-colors"
                    )}
                  >
                    {locale === "ar" ? "ابدأ مجاناً" : "Commencer"}
                  </Link>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className={cn(
                "lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-full",
                "text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)] transition-colors",
                "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              )}
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <Icon name={mobileMenuOpen ? "close" : "menu"} className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu — slide-down panel */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[var(--color-border)] bg-[var(--color-surface)] animate-slide-down">
          <div className="page-container py-4 space-y-1">
            {links.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "block px-4 py-3 rounded-xl text-[15px] font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-[var(--color-surface-sunken)] text-[var(--color-text-strong)]"
                    : "text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
                )}
              >
                {link.name}
              </Link>
            ))}
            {profile?.role === "admin" && (
              <Link
                href={`/${locale}/admin`}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 rounded-xl text-[15px] font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              >
                {t("admin")}
              </Link>
            )}

            <div className="pt-3 mt-2 border-t border-[var(--color-border-subtle)] space-y-2">
              <div className="px-4 py-2 sm:hidden">
                <LanguageSwitcher />
              </div>
              {user ? (
                <>
                  <div className="px-4 py-2 flex items-center gap-3">
                    <Avatar name={displayName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-strong)] truncate">
                        {displayName || user.email}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    href={`/${locale}/profile`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-3 text-[15px] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] rounded-xl"
                  >
                    {t("profile")}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left rtl:text-right px-4 py-3 text-[15px] text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] rounded-xl"
                  >
                    {t("logout")}
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-2">
                  <Link
                    href={`/${locale}/login`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center h-12 inline-flex items-center justify-center rounded-xl text-[15px] font-medium border border-[var(--color-border-strong)] text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)]"
                  >
                    {t("login")}
                  </Link>
                  <Link
                    href={`/${locale}/register`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center h-12 inline-flex items-center justify-center rounded-xl text-[15px] font-medium bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)] shadow-[var(--shadow-1)]"
                  >
                    {locale === "ar" ? "ابدأ مجاناً" : "Commencer"}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
