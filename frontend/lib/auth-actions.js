"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Sign out reliably.
 *
 * `router.push()` after `signOut()` does a soft client navigation, which lets
 * Next's prefetched pages and the SSR middleware run against the *previous*
 * cookies (the signed-out cookies haven't always been flushed in time). The
 * symptom: clicking "Déconnexion" appears to do nothing because middleware
 * still sees an authenticated session and redirects right back.
 *
 * A hard navigation via `window.location.replace` guarantees the browser
 * re-sends the (now-cleared) cookies on the next request, and the middleware
 * sees the user as truly signed out.
 *
 * `scope: "local"` is the default — we keep it explicit for clarity. It signs
 * out this device but keeps other sessions on other devices.
 */
export async function signOutAndRedirect({ locale = "fr", to = "/login" } = {}) {
  const supabase = createClient();
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Even if Supabase rejects (already signed out, network blip), still kick
    // the user to /login — the local tokens are gone either way.
  }
  try {
    // Defensive belt + braces: nuke any Supabase storage by hand. The SSR
    // helper usually does this, but if it failed we still want to be clean.
    if (typeof window !== "undefined") {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const ref = url.match(/https?:\/\/([^.]+)\./)?.[1];
      if (ref) {
        localStorage.removeItem(`sb-${ref}-auth-token`);
      }
    }
  } catch {}

  const target = to.startsWith("/") ? `/${locale}${to}` : `/${locale}/${to}`;
  if (typeof window !== "undefined") {
    window.location.replace(target);
  }
}
