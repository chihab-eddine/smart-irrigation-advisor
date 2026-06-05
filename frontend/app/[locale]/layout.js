import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import "../globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider, ThemeBootstrap } from "@/components/ThemeProvider";
import { createClient as createServerClient } from "@/lib/supabase/server";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic-loaded",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: {
    default: "Saqi — Conseiller d'irrigation et de santé des cultures",
    template: "%s · Saqi",
  },
  description:
    "Saqi vous donne une réponse claire chaque jour : combien d'eau, quand, et que faire si une feuille semble malade. Pour les agriculteurs marocains.",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1310" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;

  const locales = ["fr", "ar"];
  if (!locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages({ locale });
  const isRtl = locale === "ar";
  const fontVars = `${inter.variable} ${plexArabic.variable}`;

  // Read auth state on the server so the shell renders correctly on first paint
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    profile = data || null;
  }

  return (
    <html
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
      className={`${fontVars} h-full`}
      suppressHydrationWarning
    >
      <head>
        <ThemeBootstrap />
      </head>
      <body className="app-shell">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <AuthProvider initialUser={user} initialProfile={profile}>
              <AppShell>{children}</AppShell>
            </AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
