/**
 * Friendly, bilingual mappings for Supabase auth errors.
 * Never surface a raw provider message to a farmer.
 *
 * Use:  friendlyAuthError(error, locale)  → string
 */

const MAP = {
  // Email/password sign-in
  "invalid login credentials": {
    fr: "Email ou mot de passe incorrect. Vérifiez et réessayez.",
    ar: "البريد الإلكتروني أو كلمة السر غير صحيحة. تأكد وحاول مجدداً.",
  },
  "invalid_credentials": {
    fr: "Email ou mot de passe incorrect. Vérifiez et réessayez.",
    ar: "البريد الإلكتروني أو كلمة السر غير صحيحة. تأكد وحاول مجدداً.",
  },
  "email not confirmed": {
    fr: "Confirmez votre email. Cherchez le message de Saqi dans votre boîte (ou les spams).",
    ar: "أكّد بريدك الإلكتروني. ابحث عن رسالة من ساقي في صندوقك (أو المهملات).",
  },
  // Sign-up
  "user already registered": {
    fr: "Un compte existe déjà avec cet email. Connectez-vous ou réinitialisez votre mot de passe.",
    ar: "يوجد حساب مسبق بهذا البريد. سجّل دخولك أو أعد تعيين كلمة السر.",
  },
  "password should be at least 6 characters": {
    fr: "Choisissez un mot de passe d'au moins 6 caractères.",
    ar: "اختر كلمة سر من 6 رموز على الأقل.",
  },
  "password should be at least 8 characters": {
    fr: "Choisissez un mot de passe d'au moins 8 caractères.",
    ar: "اختر كلمة سر من 8 رموز على الأقل.",
  },
  "signups not allowed": {
    fr: "Les inscriptions sont temporairement fermées. Réessayez plus tard.",
    ar: "التسجيل مغلق مؤقتاً. حاول لاحقاً.",
  },
  // Reset/magic link
  "user not found": {
    // Privacy: don't confirm existence
    fr: "Si un compte existe pour cet email, vous recevrez un message.",
    ar: "إذا كان هناك حساب بهذا البريد، ستصلك رسالة.",
  },
  "token has expired or is invalid": {
    fr: "Le lien est expiré ou invalide. Demandez un nouveau lien.",
    ar: "الرابط منتهٍ أو غير صالح. اطلب رابطاً جديداً.",
  },
  // Rate / throttling
  "email rate limit exceeded": {
    fr: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
    ar: "محاولات كثيرة. انتظر بضع دقائق قبل المعاودة.",
  },
  "over_request_rate_limit": {
    fr: "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
    ar: "محاولات كثيرة. انتظر بضع دقائق قبل المعاودة.",
  },
  // Network
  "fetch failed": {
    fr: "Pas de connexion. Vérifiez votre réseau et réessayez.",
    ar: "لا يوجد اتصال. تحقق من الشبكة وحاول مجدداً.",
  },
  "network error": {
    fr: "Pas de connexion. Vérifiez votre réseau et réessayez.",
    ar: "لا يوجد اتصال. تحقق من الشبكة وحاول مجدداً.",
  },
};

const FALLBACK = {
  fr: "Action impossible pour le moment. Réessayez dans un instant.",
  ar: "تعذر تنفيذ العملية حالياً. حاول بعد قليل.",
};

export function friendlyAuthError(error, locale = "fr") {
  if (!error) return null;
  const lc = locale === "ar" ? "ar" : "fr";
  const raw = (typeof error === "string" ? error : error.message || error.error_description || "")
    .toString()
    .toLowerCase()
    .trim();
  if (!raw) return FALLBACK[lc];

  // Direct match
  if (MAP[raw]) return MAP[raw][lc];

  // Substring scan — Supabase wraps and prefixes messages
  for (const key in MAP) {
    if (raw.includes(key)) return MAP[key][lc];
  }

  return FALLBACK[lc];
}
