"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import Icon from "./Icon";
import { useAuth } from "./AuthProvider";
import { Sheet, Button, Badge, cn } from "./ui";
import { createAPIClient } from "@/lib/api";

const OPEN_EVENT = "saqi:agronomist-open";

/** Imperative opener for the floating chat — usable from any client component. */
export function openAgronomistChat(initialQuestion) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { initialQuestion } }));
}

const FAQ = {
  fr: [
    { q: "Quand arroser mes oliviers ?",          icon: "droplet" },
    { q: "Comment reconnaître le mildiou ?",       icon: "leaf" },
    { q: "Combien d'eau pour des tomates ?",       icon: "droplet" },
    { q: "Que faire en cas de vague de chaleur ?", icon: "sun" },
    { q: "Mes feuilles jaunissent, pourquoi ?",    icon: "alertCircle" },
    { q: "Quel engrais pour le blé ?",             icon: "sprout" },
  ],
  ar: [
    { q: "متى أسقي زيتوني؟",                       icon: "droplet" },
    { q: "كيف أتعرف على المنّ والمرض؟",            icon: "leaf" },
    { q: "كم من الماء تحتاج الطماطم؟",             icon: "droplet" },
    { q: "ماذا أفعل في موجة الحر؟",                icon: "sun" },
    { q: "أوراقي تصفرّ، ما السبب؟",                icon: "alertCircle" },
    { q: "ما السماد المناسب للقمح؟",               icon: "sprout" },
  ],
};

const SEED = {
  fr: "Salam ! Je suis votre conseiller agronomique. Posez-moi une question — eau, maladies, sol, météo, fertilisation.",
  ar: "السلام عليكم! أنا مستشارك الزراعي. اسألني — الماء، الأمراض، التربة، الطقس، التسميد.",
};

export default function AgronomistChat() {
  const locale = useLocale();
  const ar = locale === "ar";
  const { user, accessToken } = useAuth();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => [{ role: "agent", content: SEED[ar ? "ar" : "fr"] }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollerRef = useRef(null);

  // Subscribe to global open events (from "Demandez à l'agronome" cards)
  useEffect(() => {
    const handler = (e) => {
      setOpen(true);
      const q = e.detail?.initialQuestion;
      if (q) setDraft(q);
    };
    window.addEventListener(OPEN_EVENT, handler);
    return () => window.removeEventListener(OPEN_EVENT, handler);
  }, []);

  // Refresh seed when locale flips
  useEffect(() => {
    setMessages((prev) =>
      prev.length === 1 ? [{ role: "agent", content: SEED[ar ? "ar" : "fr"] }] : prev
    );
  }, [ar]);

  // Auto-scroll on new message
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy, open]);

  const send = async (text) => {
    const q = (text ?? draft).trim();
    if (!q || busy) return;
    const next = [...messages, { role: "user", content: q }];
    setMessages(next);
    setDraft("");
    setError("");
    if (!accessToken) {
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: ar
            ? "سجّل دخولك أولاً لاستخدام الاستشاري."
            : "Connectez-vous pour utiliser le conseiller.",
        },
      ]);
      return;
    }
    setBusy(true);
    try {
      const client = createAPIClient(accessToken);
      const apiMessages = next.map((m) => ({
        role: m.role === "agent" ? "assistant" : "user",
        content: m.content,
      }));
      const res = await client.aiChat(apiMessages, locale);
      // Backend returns AITextResponse: { text, model, available }
      const answer =
        res?.text ||
        res?.answer ||
        res?.message ||
        res?.reply ||
        (ar
          ? "لم أتمكن من الإجابة الآن. حاول مجدداً."
          : "Je n'ai pas pu répondre. Réessayez.");
      setMessages((prev) => [...prev, { role: "agent", content: answer }]);
    } catch (e) {
      setError(e?.message || (ar ? "تعذر الاتصال." : "Connexion impossible."));
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: ar
            ? "تعذر الاتصال. تحقق من الشبكة وحاول مجدداً."
            : "Connexion impossible. Vérifiez votre réseau et réessayez.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  // Hide entirely when not authenticated — we don't want to tease a feature
  // that won't work, but render the empty fragment to keep hook order stable.
  if (!user) return null;

  const showFaq = messages.length <= 1;
  const faqList = FAQ[ar ? "ar" : "fr"];

  return (
    <>
      {/* Floating action button — sits above the bottom nav on mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ar ? "اسأل الاستشاري" : "Demandez à l'agronome"}
        className={cn(
          "fixed z-30 end-4 lg:end-6 group",
          // Lifted above the bottom nav on mobile via safe-area-aware offset
          "bottom-[calc(var(--bottom-nav-height,64px)+env(safe-area-inset-bottom,0px)+16px)] lg:bottom-6",
          "h-14 w-14 rounded-2xl",
          "bg-[var(--color-accent-500)] text-white",
          "shadow-[var(--shadow-3)]",
          "inline-flex items-center justify-center",
          "transition-transform duration-200 hover:scale-105 active:scale-95",
          "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
        )}
      >
        <span className="absolute -top-1 -end-1 h-3 w-3 rounded-full bg-[var(--color-secondary-500)] ring-2 ring-[var(--color-bg)] animate-pulse-soft" />
        <Icon name="send" className="h-6 w-6 rtl-flip" strokeWidth={2.25} />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={ar ? "اسأل الاستشاري" : "Demandez à l'agronome"}
        description={ar ? "إجابات قصيرة وعملية." : "Réponses courtes et concrètes."}
        size="lg"
        footer={
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-end gap-2"
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={ar ? "اكتب سؤالك..." : "Tapez votre question…"}
              rows={1}
              className="flex-1 resize-none bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-xl px-3.5 py-3 text-[15px] focus:border-[var(--color-primary-500)] focus:outline-none focus:shadow-[var(--shadow-focus)]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button
              type="submit"
              iconOnly
              leadingIcon="send"
              size="md"
              disabled={!draft.trim() || busy}
              loading={busy}
              aria-label={ar ? "إرسال" : "Envoyer"}
            />
          </form>
        }
      >
        <div ref={scrollerRef} className="space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line",
                m.role === "user"
                  ? "ms-auto bg-[var(--color-primary-600)] text-white rounded-tr-md"
                  : "me-auto bg-[var(--color-surface-sunken)] text-[var(--color-text-strong)] rounded-tl-md"
              )}
            >
              {m.content}
            </div>
          ))}

          {busy && (
            <div className="me-auto bg-[var(--color-surface-sunken)] rounded-2xl px-4 py-2.5 rounded-tl-md inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--color-text-muted)] animate-pulse-soft" style={{ animationDelay: "0ms" }} />
              <span className="h-2 w-2 rounded-full bg-[var(--color-text-muted)] animate-pulse-soft" style={{ animationDelay: "200ms" }} />
              <span className="h-2 w-2 rounded-full bg-[var(--color-text-muted)] animate-pulse-soft" style={{ animationDelay: "400ms" }} />
            </div>
          )}

          {showFaq && (
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="accent" size="md" icon="info">
                  {ar ? "أسئلة شائعة" : "Questions fréquentes"}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {faqList.map((it) => (
                  <button
                    key={it.q}
                    type="button"
                    onClick={() => send(it.q)}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl text-left rtl:text-right",
                      "bg-[var(--color-surface)] border border-[var(--color-border)]",
                      "hover:border-[var(--color-primary-300)] hover:bg-[var(--color-surface-muted)]",
                      "transition-colors duration-150 active:scale-[.99]",
                      "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                    )}
                  >
                    <span className="h-9 w-9 shrink-0 rounded-xl bg-[var(--color-primary-100)] text-[var(--color-primary-700)] inline-flex items-center justify-center">
                      <Icon name={it.icon} className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-strong)] leading-snug">
                      {it.q}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                {ar
                  ? "أو اكتب سؤالك بأسلوبك في الأسفل."
                  : "Ou tapez votre question en bas dans vos mots."}
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-[var(--color-danger)] mt-2">{error}</p>
          )}
        </div>
      </Sheet>
    </>
  );
}
