import createMiddleware from 'next-intl/middleware';
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['fr', 'ar'],
  defaultLocale: 'fr',
  localePrefix: 'always'
});

export async function middleware(request) {
  const pathname = request.nextUrl.pathname;

  // Don't apply next-intl to API routes or auth callbacks — they aren't
  // locale-prefixed and would 308-redirect into nonexistent /fr/api/...,
  // /fr/auth/... paths, which is what makes Supabase confirmation links 404.
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return NextResponse.next();
  }

  // 1. Let next-intl handle localization routing first
  const response = intlMiddleware(request);

  // If next-intl decided to redirect (e.g. adding locale prefix), return the response immediately
  if (response.headers.get('x-middleware-rewrite') || response.status === 307 || response.status === 308) {
    return response;
  }

  let supabaseResponse = response;

  // 2. Initialize Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          // Copy next-intl headers
          response.headers.forEach((value, key) => {
            supabaseResponse.headers.set(key, value);
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Retrieve authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  const pathWithoutLocale = pathname.replace(/^\/(fr|ar)/, '') || '/';

  // Get active locale (default to 'fr')
  const localeMatch = pathname.match(/^\/(fr|ar)/);
  const locale = localeMatch ? localeMatch[1] : 'fr';

  // Auth Guards
  const protectedPaths = ["/dashboard", "/irrigation", "/disease", "/profile", "/admin"];
  const isProtected = protectedPaths.some((path) =>
    pathWithoutLocale === path || pathWithoutLocale.startsWith(path + "/")
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  // Admin Guard
  // Admin role check happens in the client-side admin layout, which:
  //   1. Re-fetches the profile from the DB on every mount (so a freshly-
  //      granted admin role takes effect immediately).
  //   2. Shows a clear "Accès refusé · Rôle actuel: <X>" screen if the user
  //      lacks the role — vastly easier to debug than a middleware redirect
  //      that fails silently when the SSR DB query mis-reads the role.
  //
  // The FastAPI backend independently enforces `require_admin` on every admin
  // endpoint, so there is no data leak from removing the page-level gate here.

  // Guest-Only Route Redirects (Login / Register)
  const authPaths = ["/login", "/register"];
  const isAuthPath = authPaths.some((path) => pathWithoutLocale === path);
  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
