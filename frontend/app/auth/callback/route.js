// Alias for /api/auth/callback — Supabase email templates sometimes link to
// /auth/callback (no /api prefix). Forward to the real handler so either
// path works without re-implementing the logic.
export { GET } from "@/app/api/auth/callback/route";
