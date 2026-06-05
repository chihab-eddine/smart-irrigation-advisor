import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Default locale to redirect to when the email link doesn't carry one.
const DEFAULT_LOCALE = "fr";

/**
 * Auth callback for Supabase email links.
 *
 * Handles three URL shapes Supabase may send users back with:
 *   1. ?code=...                     PKCE/OAuth code-exchange flow
 *   2. ?token_hash=...&type=signup   email confirmation via OTP
 *   3. ?token_hash=...&type=recovery password reset via OTP
 *   4. ?token_hash=...&type=...      magiclink / email_change / invite / etc.
 *
 * After the session is established we redirect based on `type`:
 *   - recovery → /<locale>/reset-password   (user must set a new password)
 *   - signup / others → /<locale>/dashboard (logged in, take them home)
 *
 * If the token is invalid or missing we send the user to /<locale>/login with
 * an `?error=` flag so the page can display a "Link expired" message instead
 * of 404-ing.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next");
  const locale = url.searchParams.get("locale") || DEFAULT_LOCALE;

  const supabase = await createClient();
  let error = null;

  if (code) {
    const { error: e } = await supabase.auth.exchangeCodeForSession(code);
    error = e;
  } else if (tokenHash && type) {
    const { error: e } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    error = e;
  } else {
    error = { message: "Missing auth parameters" };
  }

  if (error) {
    const reason = encodeURIComponent(error.message || "auth_failed");
    return NextResponse.redirect(
      `${url.origin}/${locale}/login?error=${reason}`
    );
  }

  if (type === "recovery") {
    return NextResponse.redirect(`${url.origin}/${locale}/reset-password`);
  }

  const target = next || `/${locale}/dashboard`;
  return NextResponse.redirect(`${url.origin}${target}`);
}
