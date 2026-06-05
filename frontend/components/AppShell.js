"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import Navbar from "./Navbar";
import AgronomistChat from "./AgronomistChat";
import { BottomNav, ToastProvider } from "./ui";
import { useAuth } from "./AuthProvider";

/**
 * AppShell — the responsive frame. Wraps every page.
 *  - Marketing pages (unauth or anonymous routes): just a Navbar.
 *  - Authenticated app pages: Navbar (lg+) + BottomNav (mobile).
 *  - Some routes opt out of the shell entirely (onboarding, capture).
 */
export default function AppShell({ children }) {
  const pathname = usePathname();
  const locale = useLocale();
  const { user } = useAuth();

  // Strip the locale prefix so we can match routes without re-stringifying
  const route = pathname?.replace(/^\/(fr|ar)/, "") || "/";

  // Full-bleed routes have no shell — they manage their own chrome
  const FULL_BLEED = [
    "/onboarding",
    "/disease/capture",
    "/admin",
  ];
  const isFullBleed = FULL_BLEED.some((p) => route === p || route.startsWith(p + "/"));

  if (isFullBleed) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  // Tabs visible only to authenticated users
  const showBottomNav = Boolean(user);

  const ar = locale === "ar";
  const tabs = [
    { key: "today",      href: `/${locale}/today`,      label: ar ? "اليوم" : "Aujourd'hui", icon: "sun" },
    { key: "irrigation", href: `/${locale}/irrigation`, label: ar ? "الري" : "Irrigation",   icon: "droplet" },
    { key: "health",     href: `/${locale}/disease`,    label: ar ? "صحة"  : "Santé",        icon: "leaf" },
    { key: "account",    href: `/${locale}/profile`,    label: ar ? "حسابي": "Compte",       icon: "user" },
  ];
  const fab = {
    key: "capture",
    href: `/${locale}/disease`,
    label: ar ? "تشخيص" : "Diagnostiquer",
    icon: "image",
  };

  return (
    <ToastProvider>
      <Navbar variant={user ? "app" : "marketing"} />
      <main className={showBottomNav ? "app-main" : "flex-1"}>
        {children}
      </main>
      {showBottomNav && <BottomNav items={tabs} fab={fab} />}
      <AgronomistChat />
    </ToastProvider>
  );
}
