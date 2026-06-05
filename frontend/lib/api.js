/**
 * API client for the FastAPI backend.
 */

function getApiUrl() {
  // Production behavior (when hosted on GCP VM via PM2 & Caddy)
  if (process.env.NODE_ENV === "production") {
    if (typeof window === "undefined") {
      // Server-Side Rendering (SSR) — talk directly to local backend process
      return "http://127.0.0.1:8000";
    }
    // Client-side (Browser or Capacitor) — use relative path, Caddy handles routing
    return "";
  }

  // Local development behavior
  if (typeof window !== "undefined" && window.location.hostname === "10.0.2.2") {
    return "http://10.0.2.2:8000";
  }
  return "http://localhost:8000";
}
function buildNetworkError(url, error) {
  const cause = error?.message ? ` (${error.message})` : "";
  return new Error(
    `Impossible de contacter l'API backend à ${url}. ` +
      `Vérifiez que FastAPI tourne et que NEXT_PUBLIC_API_URL pointe vers le bon port.${cause}`
  );
}

async function fetchAPI(endpoint, options = {}) {
  const url = `${getApiUrl()}${endpoint}`;
  const hasBody = options.body !== undefined && options.body !== null;

  // Only send Content-Type when there is a JSON body. Adding it to GET
  // requests forces avoidable browser CORS preflights.
  const config = {
    ...options,
    headers: {
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  };

  let response;
  try {
    response = await fetch(url, config);
  } catch (error) {
    throw buildNetworkError(url, error);
  }

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: response.statusText || "Request failed" }));
    // Translate the raw 401 detail ("Missing or invalid authorization header")
    // into something a user can act on instead of leaking backend internals.
    if (response.status === 401) {
      const e = new Error("Session expirée — reconnectez-vous pour continuer.");
      e.status = 401;
      throw e;
    }
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchFormAPI(endpoint, formData, options = {}) {
  const url = `${getApiUrl()}${endpoint}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      body: formData,
    });
  } catch (error) {
    throw buildNetworkError(url, error);
  }

  const payload = await response
    .json()
    .catch(() => ({ detail: "Request failed" }));

  if (!response.ok) {
    if (response.status === 401) {
      const e = new Error("Session expirée — reconnectez-vous pour continuer.");
      e.status = 401;
      throw e;
    }
    throw new Error(payload.detail || `HTTP ${response.status}`);
  }

  return payload;
}

/**
 * Create an authenticated API client.
 * @param {string} token - Supabase JWT token
 */
export function createAPIClient(token) {
  const authHeaders = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  return {
    // Reference data
    getCrops: () => fetchAPI("/api/crops"),
    getSoilTypes: () => fetchAPI("/api/soil-types"),
    getRegions: () => fetchAPI("/api/regions"),

    // Weather
    getWeather: (regionId) => fetchAPI(`/api/weather/${regionId}`),

    // Irrigation
    predictIrrigation: (data) =>
      fetchAPI("/api/irrigation/predict", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(data),
      }),
    getIrrigationHistory: (limit = 20, offset = 0) =>
      fetchAPI(`/api/irrigation/history?limit=${limit}&offset=${offset}`, {
        headers: authHeaders,
      }),
    getIrrigationCalculation: (predictionId, locale = "fr") =>
      fetchAPI(`/api/irrigation/${predictionId}?locale=${encodeURIComponent(locale)}`, {
        headers: authHeaders,
      }),
    getCurrentPlantationUpdates: (locale = "fr", limit = 6) =>
      fetchAPI(`/api/irrigation/plantations/current?locale=${encodeURIComponent(locale)}&limit=${limit}`, {
        headers: authHeaders,
      }),
    getIrrigationAIRecommendation: (predictionId, locale = "fr") =>
      fetchAPI(`/api/irrigation/${predictionId}/ai-recommendation?locale=${encodeURIComponent(locale)}`, {
        headers: authHeaders,
      }),

    // Disease Detection
    predictDisease: (formData) =>
      fetchFormAPI("/api/disease/predict", formData, {
        method: "POST",
        headers: { ...authHeaders },
      }),
    getDiseaseHistory: (limit = 20, offset = 0) =>
      fetchAPI(`/api/disease/history?limit=${limit}&offset=${offset}`, {
        headers: authHeaders,
      }),
    getDiseaseDiagnosis: (predictionId, locale = "fr") =>
      fetchAPI(`/api/disease/${predictionId}?locale=${encodeURIComponent(locale)}`, {
        headers: authHeaders,
      }),
    getDiseaseClasses: () => fetchAPI("/api/disease/classes"),

    // Contact (public)
    submitContact: (data) =>
      fetchAPI("/api/contact", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Newsletter (public)
    subscribeNewsletter: (data) =>
      fetchAPI("/api/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    unsubscribeNewsletter: (data) =>
      fetchAPI("/api/newsletter/unsubscribe", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    // Admin
    getAdminStats: () =>
      fetchAPI("/api/admin/stats", { headers: authHeaders }),
    getAdminUsers: (page = 1, search = "") =>
      fetchAPI(`/api/admin/users?page=${page}&search=${search}`, {
        headers: authHeaders,
      }),
    updateAdminUser: (userId, data) =>
      fetchAPI(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(data),
      }),
    getAdminContacts: (page = 1, status = "") =>
      fetchAPI(`/api/admin/contacts?page=${page}&status=${status}`, {
        headers: authHeaders,
      }),
    updateAdminContact: (contactId, data) =>
      fetchAPI(`/api/admin/contacts/${contactId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(data),
      }),
    deleteAdminContact: (contactId) =>
      fetchAPI(`/api/admin/contacts/${contactId}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
    getAdminNewsletter: (page = 1) =>
      fetchAPI(`/api/admin/newsletter?page=${page}`, {
        headers: authHeaders,
      }),
    getNewsletterStats: () =>
      fetchAPI("/api/admin/newsletter/stats", { headers: authHeaders }),
    deleteNewsletterSubscriber: (subscriberId) =>
      fetchAPI(`/api/admin/newsletter/${subscriberId}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
    getAdminConfig: () =>
      fetchAPI("/api/admin/config", { headers: authHeaders }),
    updateAdminConfig: (key, value) =>
      fetchAPI(`/api/admin/config/${key}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ value }),
      }),

    // ---------- Admin · Blog CRUD ----------
    getAdminBlogPosts: ({ page = 1, search = "", category = "", status = "" } = {}) => {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      if (status) params.set("status", status);
      return fetchAPI(`/api/admin/blog/posts?${params.toString()}`, { headers: authHeaders });
    },
    getAdminBlogPost: (postId) =>
      fetchAPI(`/api/admin/blog/posts/${postId}`, { headers: authHeaders }),
    createAdminBlogPost: (data) =>
      fetchAPI("/api/admin/blog/posts", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(data),
      }),
    updateAdminBlogPost: (postId, data) =>
      fetchAPI(`/api/admin/blog/posts/${postId}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify(data),
      }),
    deleteAdminBlogPost: (postId) =>
      fetchAPI(`/api/admin/blog/posts/${postId}`, {
        method: "DELETE",
        headers: authHeaders,
      }),

    // ---------- AI advisor ----------
    aiStatus: () => fetchAPI("/api/ai/status"),
    aiIrrigationTips: (payload) =>
      fetchAPI("/api/ai/irrigation-tips", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      }),
    aiDiseaseTips: (payload) =>
      fetchAPI("/api/ai/disease-tips", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      }),
    aiDailyInsight: (locale = "fr") =>
      fetchAPI(`/api/ai/daily-insight?locale=${encodeURIComponent(locale)}`, {
        headers: authHeaders,
      }),
    aiChat: (messages, locale = "fr") =>
      fetchAPI("/api/ai/chat", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ messages, locale }),
      }),

    // ---------- Notification preferences ----------
    getNotificationPrefs: () =>
      fetchAPI("/api/preferences/notifications", { headers: authHeaders }),
    updateNotificationPrefs: (prefs) =>
      fetchAPI("/api/preferences/notifications", {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(prefs),
      }),
    sendTestReminder: (locale = "fr") =>
      fetchAPI("/api/reminders/send-test", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ locale }),
      }),

    // ---------- Blog ----------
    listBlogPosts: ({ locale = "fr", limit = 20, offset = 0, category } = {}) => {
      const qs = new URLSearchParams({ locale, limit, offset });
      if (category) qs.set("category", category);
      return fetchAPI(`/api/blog/posts?${qs.toString()}`);
    },
    getBlogPost: (slug, locale = "fr") =>
      fetchAPI(`/api/blog/posts/${encodeURIComponent(slug)}?locale=${locale}`, {
        headers: authHeaders,   // optional — server tolerates missing/invalid
      }),
    addBlogComment: (postId, content) =>
      fetchAPI(`/api/blog/posts/${postId}/comments`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ content }),
      }),
    deleteBlogComment: (postId, commentId) =>
      fetchAPI(`/api/blog/posts/${postId}/comments/${commentId}`, {
        method: "DELETE",
        headers: authHeaders,
      }),
    rateBlogPost: (postId, rating) =>
      fetchAPI(`/api/blog/posts/${postId}/rating`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ rating }),
      }),
  };
}
