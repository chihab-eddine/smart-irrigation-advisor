"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { signOutAndRedirect } from "@/lib/auth-actions";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Icon from "@/components/Icon";
import {
  Avatar,
  Badge,
  Button,
  Spinner,
  ThemeToggle,
  ToastProvider,
  cn,
} from "@/components/ui";

const STORAGE_COLLAPSED = "saqi:admin:collapsed";

export default function AdminLayout({ children }) {
  return (
    <ToastProvider>
      <AdminInner>{children}</AdminInner>
    </ToastProvider>
  );
}

function AdminInner({ children }) {
  const locale = useLocale();
  const ar = locale === "ar";
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Restore collapsed state
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_COLLAPSED);
      if (v === "1") setCollapsed(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COLLAPSED, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (user === null) {
      router.replace(`/${locale}/login?next=/admin`);
    }
  }, [user, locale, router]);

  // Refresh the profile in the background once on mount, so a freshly-granted
  // admin role takes effect without sign-out/in. We don't block rendering on
  // this — we use whatever profile is already in context (hydrated server-side
  // in the locale layout) and only kick a refresh to update it.
  useEffect(() => {
    if (!user?.id) return;
    refreshProfile().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleLogout = async () => {
    await signOutAndRedirect({ locale, to: "/login" });
  };

  const menuItems = [
    {
      labelFr: "Tableau de bord",
      labelAr: "نظرة عامة",
      href: `/${locale}/admin`,
      exact: true,
      icon: "dashboard",
      tone: "primary",
    },
    {
      labelFr: "Utilisateurs",
      labelAr: "المستخدمون",
      href: `/${locale}/admin/users`,
      icon: "users",
      tone: "accent",
    },
    {
      labelFr: "Messages",
      labelAr: "الرسائل",
      href: `/${locale}/admin/contacts`,
      icon: "inbox",
      tone: "secondary",
    },
    {
      labelFr: "Blog",
      labelAr: "المدوّنة",
      href: `/${locale}/admin/blog`,
      icon: "edit",
      tone: "secondary",
    },
    {
      labelFr: "Newsletter",
      labelAr: "النشرة",
      href: `/${locale}/admin/newsletter`,
      icon: "mail",
      tone: "primary",
    },
    {
      labelFr: "Configuration",
      labelAr: "الإعدادات",
      href: `/${locale}/admin/config`,
      icon: "settings",
      tone: "accent",
    },
  ];

  const labelOf = (item) => (ar ? item.labelAr : item.labelFr);
  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname?.startsWith(item.href + "/");

  // TEMP — presentation mode: any logged-in user can access /admin.
  // Restore the role + profile gates below before going live.
  //
  //   if (!profile) return <ProfileNotFoundScreen />;
  //   if (profile.role !== "admin") return <AccessDeniedScreen />;
  //
  // Backend admin endpoints are still protected by `require_admin` in FastAPI,
  // so non-admins will see the UI but every admin API call will return 403.

  if (!user) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const sidebarW = collapsed ? "lg:w-[72px]" : "lg:w-64";

  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Admin";

  return (
    <div className="min-h-[100dvh] flex bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* === SIDEBAR === */}
      <aside
        className={cn(
          "fixed lg:sticky inset-y-0 z-50 lg:z-30",
          "bg-[var(--color-surface)] border-e border-[var(--color-border)]",
          "flex flex-col shrink-0 h-[100dvh] top-0",
          "transition-[width,transform] duration-200 ease-out",
          sidebarW,
          mobileOpen ? "translate-x-0 w-72" : "-translate-x-full rtl:translate-x-full w-72 lg:translate-x-0"
        )}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        {/* Brand */}
        <div
          className={cn(
            "h-16 flex items-center gap-2.5 px-4 border-b border-[var(--color-border)] shrink-0",
            collapsed && "justify-center lg:px-2"
          )}
        >
          <Link href={`/${locale}/admin`} className="flex items-center gap-2.5 min-w-0">
            <span className="h-9 w-9 shrink-0 rounded-xl bg-[var(--color-text-strong)] text-[var(--color-text-inverse)] inline-flex items-center justify-center shadow-[var(--shadow-1)]">
              <Icon name="shield" className="h-4.5 w-4.5" strokeWidth={2} />
            </span>
            {!collapsed && (
              <div className="leading-tight min-w-0">
                <p className="text-[15px] font-semibold text-[var(--color-text-strong)] tracking-tight">
                  {ar ? "إدارة Saqi" : "Saqi Admin"}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {ar ? "لوحة التحكم" : "Backoffice"}
                </p>
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden ms-auto h-9 w-9 inline-flex items-center justify-center rounded-full text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)]"
            aria-label="Close menu"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? labelOf(item) : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl text-sm font-medium",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                  collapsed ? "px-2 py-2.5 justify-center" : "px-3 py-2.5",
                  active
                    ? "bg-[var(--color-primary-100)] text-[var(--color-primary-800)]"
                    : "text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-strong)]"
                )}
              >
                <Icon
                  name={item.icon}
                  className={cn("h-[18px] w-[18px] shrink-0", active && "text-[var(--color-primary-700)]")}
                  strokeWidth={active ? 2.2 : 1.75}
                />
                {!collapsed && <span className="truncate">{labelOf(item)}</span>}
                {!collapsed && active && (
                  <span className="ms-auto h-1.5 w-1.5 rounded-full bg-[var(--color-primary-600)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={cn(
          "border-t border-[var(--color-border)] p-3 space-y-2 shrink-0",
          collapsed && "lg:p-2"
        )}>
          {!collapsed && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-[var(--color-surface-sunken)]">
              <Avatar name={displayName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--color-text-strong)] truncate">{displayName}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">{user.email}</p>
              </div>
            </div>
          )}

          <div className={cn(
            "flex items-center gap-1.5",
            collapsed ? "flex-col" : "justify-between"
          )}>
            <LanguageSwitcher compact />
            <ThemeToggle compact />
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand" : "Collapse"}
              className="hidden lg:inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)] transition-colors"
            >
              <Icon
                name={collapsed ? "chevronRight" : "chevronLeft"}
                className="h-4 w-4 rtl-flip"
              />
            </button>
          </div>

          <Link
            href={`/${locale}/today`}
            title={collapsed ? (ar ? "العودة إلى التطبيق" : "Retour à l'app") : undefined}
            className={cn(
              "flex items-center gap-2 rounded-xl text-sm font-medium",
              "border border-[var(--color-border-strong)]",
              "text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)] transition-colors",
              collapsed ? "h-10 w-10 justify-center lg:mx-auto" : "h-10 px-3"
            )}
          >
            <Icon name="arrowLeft" className="h-4 w-4 rtl-flip text-[var(--color-text-muted)]" />
            {!collapsed && (ar ? "العودة إلى التطبيق" : "Retour à l'app")}
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title={collapsed ? (ar ? "تسجيل الخروج" : "Déconnexion") : undefined}
            className={cn(
              "flex items-center gap-2 rounded-xl text-sm font-medium",
              "border border-[var(--color-danger-border)]",
              "text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors w-full",
              collapsed ? "h-10 w-10 justify-center lg:mx-auto" : "h-10 px-3"
            )}
          >
            <Icon name="logout" className="h-4 w-4 rtl-flip" />
            {!collapsed && (ar ? "تسجيل الخروج" : "Déconnexion")}
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-fade-in"
        />
      )}

      {/* === MAIN === */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header
          className="lg:hidden sticky top-0 z-30 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)]"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="h-14 px-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="h-10 w-10 inline-flex items-center justify-center rounded-full hover:bg-[var(--color-surface-muted)]"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <span className="h-7 w-7 rounded-lg bg-[var(--color-text-strong)] text-[var(--color-text-inverse)] inline-flex items-center justify-center shrink-0">
                <Icon name="shield" className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <p className="text-[15px] font-semibold text-[var(--color-text-strong)] tracking-tight truncate">
                {ar ? "إدارة Saqi" : "Saqi Admin"}
              </p>
            </div>
            <div className="ms-auto flex items-center gap-1">
              <ThemeToggle compact />
              <Avatar name={displayName} size="xs" />
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 p-5 sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
