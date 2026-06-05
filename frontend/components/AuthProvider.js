"use client";

/**
 * Auth context provider.
 *
 * The locale layout fetches the user + profile server-side and passes them as
 * `initialUser` / `initialProfile`. We seed local state with those values so
 * the very first client render already shows the logged-in UI — no flash of
 * "login/register" buttons while a client-side `getSession()` round-trips.
 *
 * After mount we subscribe to `onAuthStateChange` so login/logout/refresh
 * events propagate everywhere the context is consumed.
 */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const AuthContext = createContext({
  user: null,
  profile: null,
  accessToken: null,
  loading: false,
  setProfile: () => {},
  refreshProfile: async () => null,
});

export function AuthProvider({ initialUser = null, initialProfile = null, children }) {
  const [user, setUser] = useState(initialUser);
  const [profile, setProfile] = useState(initialProfile);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  /**
   * Re-fetch the current user's profile row from Supabase. Use this after a
   * role change applied directly in the DB (or by another admin) so the new
   * permissions take effect without requiring a full sign-out/in cycle.
   */
  const refreshProfile = useCallback(async () => {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) {
      setUser(null);
      setProfile(null);
      return null;
    }
    setUser(u);
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", u.id)
      .maybeSingle();
    // Important: only set the profile if we actually got one. A null response
    // can happen when the browser supabase client's JWT hasn't propagated yet
    // (so RLS denies the SELECT). The server-side fetch in the locale layout
    // *did* succeed, so we already have a valid initialProfile in state —
    // overwriting it with null causes "Profil introuvable" false positives.
    if (data) setProfile(data);
    return data || null;
  }, [supabase]);

  useEffect(() => {
    // 1. Hydrate the access token immediately from the current session so
    //    components don't have to wait for the first auth-state event.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAccessToken(session?.access_token || null);
    });

    // 2. Keep user + profile + token in sync with all subsequent auth events
    //    (login, logout, token refresh, etc.).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setAccessToken(session?.access_token || null);
        const u = session?.user || null;
        setUser(u);
        if (u) {
          setLoading(true);
          // maybeSingle() returns null instead of throwing when no row found —
          // important because .single() would leave profile in a stuck state
          // and gates like /admin would show an indefinite spinner.
          const { data } = await supabase
            .from("users")
            .select("*")
            .eq("id", u.id)
            .maybeSingle();
          // Only set if we actually got data. A null response often means RLS
          // hasn't yet been able to evaluate the JWT (timing race during the
          // initial onAuthStateChange burst). Keep the server-hydrated
          // initialProfile rather than overwriting it with null.
          if (data) setProfile(data);
          setLoading(false);
        } else {
          setProfile(null);
        }
      }
    );
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, accessToken, loading, setProfile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
