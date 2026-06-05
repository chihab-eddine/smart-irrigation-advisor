# Supabase email templates

The HTML files in this folder are the **branded** versions of the four
Supabase auth emails. Supabase doesn't read them from this repo — you must
paste each one into the Supabase dashboard:

> **Authentication → Email Templates** → pick the template → paste the HTML.

| File | Supabase template name | Subject used |
|---|---|---|
| `confirm-signup.html` | Confirm signup | Confirmez votre adresse email |
| `recovery.html` | Reset password | Réinitialisation de votre mot de passe |
| `magic-link.html` | Magic Link | Votre lien de connexion |
| `email-change.html` | Change Email Address | Confirmez votre nouvelle adresse email |

## Configuration checklist

In addition to pasting the HTML, configure these in the Supabase dashboard:

1. **Authentication → URL Configuration → Site URL**
   Set to your deployed origin, e.g. `https://yourdomain.com` (or
   `http://localhost:3000` for dev).

2. **Authentication → URL Configuration → Redirect URLs**
   Add **all** of these:
   - `https://yourdomain.com/api/auth/callback`
   - `https://yourdomain.com/auth/callback`
   - `https://yourdomain.com/fr/reset-password`
   - `https://yourdomain.com/ar/reset-password`
   - `http://localhost:3000/api/auth/callback` (for local dev)
   - `http://localhost:3000/auth/callback`

3. **Authentication → Email Templates → "Confirm signup" → Change subject**
   to the localized one of your choice (Supabase doesn't auto-localize, so
   you may want to keep both languages in the subject:
   `Confirmez votre adresse email • تأكيد بريدك الإلكتروني`).

## Why the templates use `{{ .ConfirmationURL }}`

Supabase auto-appends `?token_hash=...&type=signup` (or `recovery`,
`magiclink`, `email_change`) to whatever Redirect URL you configured for
that template. The frontend's `/api/auth/callback` route handles both
`?code=` and `?token_hash=` shapes, so any of those work.

## Why two callback paths

Some setups send the user to `/auth/callback` (no `/api/` prefix). To make
the email work no matter how Supabase is configured, the frontend exposes
**both** `/api/auth/callback` and `/auth/callback`. Either path runs the
same logic.
