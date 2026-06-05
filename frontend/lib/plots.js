"use client";

/**
 * Plots — local-first persistence for a farmer's saved parcels.
 *
 * Stored in localStorage so the app works offline and on first visit
 * without requiring a backend migration. The server-side `users_plots`
 * table can sync up later (out of scope for this client lib).
 *
 * Shape:
 *  {
 *    id, name, crop, region, soil, plantingDate, irrigationSystem,
 *    emitterRate, spacing, createdAt, updatedAt
 *  }
 */

const KEY = "saqi:plots:v1";
const ACTIVE_KEY = "saqi:plots:active";
const ONBOARD_KEY = "saqi:onboarded:v1";

function read() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("saqi:plots-changed"));
  } catch {
    // Quota or private mode — fail silently
  }
}

export function listPlots() {
  return read();
}

export function getActivePlotId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActivePlotId(id) {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
  window.dispatchEvent(new Event("saqi:plots-changed"));
}

export function getActivePlot() {
  const id = getActivePlotId();
  const list = read();
  if (id) {
    const found = list.find((p) => p.id === id);
    if (found) return found;
  }
  return list[0] || null;
}

export function savePlot(input) {
  const now = new Date().toISOString();
  const list = read();
  const id = input.id || `plot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const idx = list.findIndex((p) => p.id === id);
  const next = {
    id,
    name: input.name?.trim() || (input.crop ? `${input.crop}` : "Ma parcelle"),
    crop: input.crop,
    region: input.region,
    soil: input.soil || "loamy",
    plantingDate: input.plantingDate || null,
    irrigationSystem: input.irrigationSystem || "drip",
    emitterRate: input.emitterRate ?? null,
    spacing: input.spacing ?? null,
    notifications: input.notifications ?? true,
    notifyTime: input.notifyTime || "06:00",
    createdAt: idx >= 0 ? list[idx].createdAt : now,
    updatedAt: now,
  };
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  write(list);
  if (!getActivePlotId() || idx < 0) {
    setActivePlotId(next.id);
  }
  return next;
}

export function deletePlot(id) {
  const next = read().filter((p) => p.id !== id);
  write(next);
  if (getActivePlotId() === id) {
    setActivePlotId(next[0]?.id || null);
  }
}

export function hasOnboarded() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ONBOARD_KEY) === "1";
}

export function markOnboarded() {
  if (typeof window === "undefined") return;
  localStorage.setItem(ONBOARD_KEY, "1");
}

export function resetOnboarding() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ONBOARD_KEY);
}

/** Subscribe to plot changes (mutations from this tab). */
export function subscribePlots(handler) {
  if (typeof window === "undefined") return () => {};
  const wrapped = () => handler(read());
  window.addEventListener("saqi:plots-changed", wrapped);
  return () => window.removeEventListener("saqi:plots-changed", wrapped);
}

/** Convenience: log an irrigation completion */
const LOG_KEY = "saqi:irrigation-log:v1";

export function logIrrigation({ plotId, amountMm, at }) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift({
      plotId,
      amountMm,
      at: at || new Date().toISOString(),
    });
    // Keep last 200
    localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(0, 200)));
    window.dispatchEvent(new Event("saqi:irrigation-logged"));
  } catch {
    // ignore
  }
}

export function readIrrigationLog(plotId) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return plotId ? list.filter((x) => x.plotId === plotId) : list;
  } catch {
    return [];
  }
}

export function lastIrrigationForPlot(plotId) {
  return readIrrigationLog(plotId)[0] || null;
}
