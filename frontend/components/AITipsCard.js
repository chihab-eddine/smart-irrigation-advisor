"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Icon from "./Icon";
import Spinner from "./Spinner";

const memoryCache = new Map();
const pendingRequests = new Map();

function makeCacheKey(title, dependsOn) {
  return `ai-tips:${title}:${dependsOn.map((item) => String(item ?? "")).join("|")}`;
}

function readCached(key) {
  if (memoryCache.has(key)) return memoryCache.get(key);
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    memoryCache.set(key, value);
    return value;
  } catch {
    return null;
  }
}

function writeCached(key, value) {
  memoryCache.set(key, value);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Non-fatal: sessionStorage can be unavailable in private mode.
  }
}

/**
 * Generic AI tips card.
 *
 * Props:
 *   - title          card heading
 *   - fetcher        async () => { text, available } — wrap the api.js call
 *   - dependsOn      array — re-fetch when any of these change
 *   - autoFetch      bool, default true. When false, shows a "Generate tips" button.
 *   - cacheKey       optional stable key. Defaults to title + dependsOn.
 *   - allowRefresh   bool, default false. Keep false to avoid burning AI tokens.
 */
export default function AITipsCard({
  title,
  fetcher,
  dependsOn = [],
  autoFetch = true,
  cacheKey,
  allowRefresh = false,
}) {
  const locale = useLocale();
  const ar = locale === "ar";
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const effectiveCacheKey = cacheKey || makeCacheKey(title, dependsOn);

  const applyResult = (res) => {
    setText(res?.text || "");
    setUnavailable(res?.available === false);
  };

  const run = async ({ force = false } = {}) => {
    setLoading(true);
    setError("");
    try {
      if (!force) {
        const cached = readCached(effectiveCacheKey);
        if (cached) {
          applyResult(cached);
          return;
        }
      }

      let request = pendingRequests.get(effectiveCacheKey);
      if (!request || force) {
        request = fetcher();
        pendingRequests.set(effectiveCacheKey, request);
      }

      const res = await request;
      const value = {
        text: res?.text || "",
        available: res?.available !== false,
      };
      writeCached(effectiveCacheKey, value);
      applyResult(value);
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.includes("not configured") || msg.includes("503")) {
        setUnavailable(true);
      } else {
        setError(msg);
      }
    } finally {
      pendingRequests.delete(effectiveCacheKey);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoFetch) return;
    // Defer to a microtask so the initial setState calls inside `run()` don't
    // count as "synchronous setState in effect" (React Compiler purity rule).
    const id = setTimeout(run, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependsOn);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="h-8 w-8 rounded-md bg-brand-50 text-brand-700 border border-brand-100 inline-flex items-center justify-center">
          <Icon name="sprout" className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {!autoFetch && !loading && !text && (
          <button
            type="button"
            onClick={() => run()}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Icon name="refresh" className="h-3.5 w-3.5 text-gray-500" />
            {ar ? "توليد" : "Générer"}
          </button>
        )}
        {allowRefresh && autoFetch && !loading && text && (
          <button
            type="button"
            onClick={() => run({ force: true })}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-gray-300 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50"
            title={ar ? "إعادة" : "Régénérer"}
          >
            <Icon name="refresh" className="h-3.5 w-3.5 text-gray-500" />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Spinner className="h-4 w-4 text-brand-600" />
          {ar ? "يولّد النصائح…" : "Génération des conseils…"}
        </div>
      )}

      {!loading && unavailable && (
        <p className="text-sm text-gray-500">
          {ar
            ? "المساعد الذكي غير مفعّل على هذا الخادم."
            : "L'assistant intelligent n'est pas activé sur ce serveur."}
        </p>
      )}

      {!loading && !unavailable && error && (
        <p className="text-sm text-red-700 inline-flex items-center gap-1.5">
          <Icon name="alertCircle" className="h-4 w-4" /> {error}
        </p>
      )}

      {!loading && !unavailable && !error && text && (
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {text}
        </div>
      )}
    </div>
  );
}
