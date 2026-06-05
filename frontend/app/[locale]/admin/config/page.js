"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "next-intl";
import Icon from "@/components/Icon";
import { useAuth } from "@/components/AuthProvider";
import { createAPIClient } from "@/lib/api";
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Input,
  Skeleton,
  Tabs,
  ToastProvider,
  useToast,
  cn,
} from "@/components/ui";

const CATEGORY_META = {
  general:    { fr: "Général",      ar: "عام",        icon: "settings",    tone: "primary" },
  weather:    { fr: "Météo",        ar: "الطقس",      icon: "cloud",       tone: "accent" },
  irrigation: { fr: "Irrigation",   ar: "الري",       icon: "droplet",     tone: "primary" },
  disease:    { fr: "Maladies",     ar: "الأمراض",    icon: "leaf",        tone: "secondary" },
  ai:         { fr: "IA",           ar: "الذكاء الاصطناعي", icon: "sprout", tone: "accent" },
  email:      { fr: "Email",        ar: "البريد",     icon: "mail",        tone: "primary" },
  ui:         { fr: "Interface",    ar: "الواجهة",    icon: "dashboard",   tone: "secondary" },
  other:      { fr: "Autres",       ar: "أخرى",       icon: "info",        tone: "neutral" },
};

export default function AdminConfigPage() {
  return (
    <ToastProvider>
      <ConfigInner />
    </ToastProvider>
  );
}

function ConfigInner() {
  const locale = useLocale();
  const ar = locale === "ar";
  const { accessToken } = useAuth();
  const toast = useToast();

  const [configs, setConfigs] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState(null);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState("all");

  const load = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const client = createAPIClient(accessToken);
      const res = await client.getAdminConfig();
      setConfigs(res || []);
      setDrafts(Object.fromEntries((res || []).map((c) => [c.key, c.value ?? ""])));
    } catch (err) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const save = async (key) => {
    if (!accessToken) return;
    setSavingKey(key);
    try {
      const client = createAPIClient(accessToken);
      await client.updateAdminConfig(key, drafts[key]);
      setConfigs((prev) => prev.map((c) => (c.key === key ? { ...c, value: drafts[key] } : c)));
      toast.push({ tone: "success", title: ar ? "تم الحفظ" : "Enregistré" });
    } catch (err) {
      toast.push({ tone: "danger", title: err?.message || "Erreur" });
    } finally {
      setSavingKey(null);
    }
  };

  const reset = (key) => {
    const original = configs.find((c) => c.key === key)?.value ?? "";
    setDrafts((d) => ({ ...d, [key]: original }));
  };

  // Group + filter
  const { categories, grouped } = useMemo(() => {
    const map = new Map();
    for (const c of configs) {
      const cat = c.category || "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(c);
    }
    const cats = Array.from(map.keys()).sort((a, b) => {
      const order = ["general", "irrigation", "disease", "weather", "ai", "email", "ui", "other"];
      const ai = order.indexOf(a); const bi = order.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return { categories: cats, grouped: map };
  }, [configs]);

  const matches = (c) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !(c.key || "").toLowerCase().includes(q) &&
        !(c.description_fr || "").toLowerCase().includes(q) &&
        !(c.description_ar || "").includes(search)
      ) return false;
    }
    return true;
  };

  const visibleCats = activeCat === "all"
    ? categories
    : categories.filter((c) => c === activeCat);

  const dirtyCount = configs.filter((c) => (drafts[c.key] ?? "") !== (c.value ?? "")).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <Badge variant="accent" icon="settings">{ar ? "الإعدادات" : "Configuration"}</Badge>
          <h1 className="display mt-3 text-3xl sm:text-4xl text-[var(--color-text-strong)]">
            {ar ? "إعدادات النظام" : "Paramètres système"}
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--color-text-muted)] max-w-2xl">
            {ar
              ? "متغيرات عامة، عتبات الطقس، وثوابت FAO-56. التعديل يؤثر فوراً على الحسابات."
              : "Variables globales, seuils météo et constantes FAO-56. Les modifications prennent effet immédiatement."}
          </p>
        </div>
        <Button onClick={load} variant="ghost" leadingIcon="refresh" loading={loading}>
          {ar ? "تحديث" : "Recharger"}
        </Button>
      </header>

      {error && <Banner tone="danger" title={ar ? "خطأ" : "Erreur"}>{error}</Banner>}

      {dirtyCount > 0 && (
        <Banner tone="warning" icon="alertCircle" title={ar ? "تعديلات غير محفوظة" : "Modifications non enregistrées"}>
          {ar
            ? `لديك ${dirtyCount} تعديل/تعديلات لم تُحفظ بعد. اضغط حفظ على كل إعداد لتأكيده.`
            : `${dirtyCount} ${dirtyCount === 1 ? "modification en attente" : "modifications en attente"}. Cliquez sur Enregistrer pour chaque paramètre.`}
        </Banner>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs
          items={[
            { value: "all", label: `${ar ? "الكل" : "Tous"} (${configs.length})` },
            ...categories.map((c) => {
              const meta = CATEGORY_META[c] || { fr: c, ar: c };
              const count = (grouped.get(c) || []).length;
              return { value: c, label: `${ar ? meta.ar : meta.fr} (${count})` };
            }),
          ]}
          value={activeCat}
          onChange={setActiveCat}
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={ar ? "ابحث بالمفتاح أو الوصف..." : "Clé ou description…"}
          leadingIcon="search"
          className="sm:w-72"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="md"><Skeleton height={120} /></Card>
          ))}
        </div>
      ) : configs.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            icon="settings"
            title={ar ? "لا إعدادات" : "Aucun paramètre"}
            description={ar ? "لم تُهيّأ أي إعدادات بعد." : "Aucun paramètre n'a été configuré."}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {visibleCats.map((cat) => {
            const meta = CATEGORY_META[cat] || CATEGORY_META.other;
            const items = (grouped.get(cat) || []).filter(matches);
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span className={cn(
                    "h-8 w-8 inline-flex items-center justify-center rounded-xl",
                    `bg-[var(--color-${meta.tone}-100)] text-[var(--color-${meta.tone}-700)]`
                  )}>
                    <Icon name={meta.icon} className="h-4 w-4" />
                  </span>
                  <h2 className="text-[15px] font-semibold text-[var(--color-text-strong)]">
                    {ar ? meta.ar : meta.fr}
                  </h2>
                  <span className="text-xs text-[var(--color-text-muted)] num">
                    {items.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((c) => (
                    <ConfigCard
                      key={c.key}
                      config={c}
                      draft={drafts[c.key] ?? ""}
                      onChange={(v) => setDrafts((d) => ({ ...d, [c.key]: v }))}
                      onSave={() => save(c.key)}
                      onReset={() => reset(c.key)}
                      saving={savingKey === c.key}
                      ar={ar}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {visibleCats.every((c) => (grouped.get(c) || []).filter(matches).length === 0) && (
            <Card padding="lg">
              <EmptyState
                icon="search"
                title={ar ? "لا نتائج" : "Aucun résultat"}
                description={ar ? "جرّب بحثاً آخر." : "Essayez une autre recherche."}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ConfigCard({ config, draft, onChange, onSave, onReset, saving, ar }) {
  const dirty = (draft ?? "") !== (config.value ?? "");
  const isNumber = config.value && !Number.isNaN(Number(config.value));
  const isLong = String(config.value || "").length > 80 || String(draft || "").length > 80;
  const desc = ar ? (config.description_ar || config.description_fr) : (config.description_fr || config.description_ar);

  return (
    <Card padding="md" className={cn(dirty && "ring-2 ring-[var(--color-warning)]/30")}>
      <div className="space-y-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <code className="text-[13px] font-mono font-semibold text-[var(--color-text-strong)] break-all">
              {config.key}
            </code>
            {dirty && (
              <Badge variant="warning" size="sm">
                {ar ? "معدّل" : "Modifié"}
              </Badge>
            )}
          </div>
          {desc && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)] leading-relaxed">
              {desc}
            </p>
          )}
        </div>

        {isLong ? (
          <textarea
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            rows={3}
            className={cn(
              "w-full bg-[var(--color-surface)] border rounded-xl px-3 py-2.5 text-sm font-mono",
              "text-[var(--color-text-strong)]",
              "border-[var(--color-border-strong)] focus:border-[var(--color-primary-500)] focus:outline-none focus:shadow-[var(--shadow-focus)]"
            )}
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            type={isNumber ? "text" : "text"}
            className="font-mono"
          />
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-[var(--color-text-muted)] truncate">
            {ar ? "القيمة الحالية:" : "Valeur actuelle :"}{" "}
            <span className="font-mono text-[var(--color-text)]">{config.value || "—"}</span>
          </p>
          <div className="flex gap-1.5 shrink-0">
            {dirty && (
              <Button onClick={onReset} variant="ghost" size="sm" leadingIcon="close">
                {ar ? "إلغاء" : "Annuler"}
              </Button>
            )}
            <Button
              onClick={onSave}
              loading={saving}
              disabled={!dirty}
              size="sm"
              leadingIcon="check"
            >
              {ar ? "حفظ" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
