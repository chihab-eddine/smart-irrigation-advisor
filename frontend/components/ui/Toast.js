"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon";
import { cn } from "./cn";

const ToastContext = createContext({
  push: () => {},
});

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    ({ tone = "success", title, description, duration = 4000, action }) => {
      const id = ++_id;
      setToasts((prev) => [...prev, { id, tone, title, description, action }]);
      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
      return id;
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      {mounted &&
        createPortal(
          <div
            className="fixed z-[60] inset-x-0 top-4 sm:top-6 px-4 flex flex-col items-center gap-2 pointer-events-none"
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            {toasts.map((t) => (
              <ToastItem key={t.id} {...t} onClose={() => remove(t.id)} />
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const TONE = {
  success: { icon: "checkCircle", fg: "text-[var(--color-success)]" },
  info:    { icon: "info",         fg: "text-[var(--color-info)]" },
  warning: { icon: "alertCircle",  fg: "text-[var(--color-warning)]" },
  danger:  { icon: "alertTriangle",fg: "text-[var(--color-danger)]" },
};

function ToastItem({ tone, title, description, action, onClose }) {
  const t = TONE[tone] || TONE.success;
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto w-full max-w-sm bg-[var(--color-surface)] border border-[var(--color-border)]",
        "rounded-xl shadow-[var(--shadow-3)] p-3.5 flex items-start gap-3 animate-slide-down"
      )}
    >
      <span className={cn("mt-0.5 shrink-0", t.fg)}>
        <Icon name={t.icon} className="h-5 w-5" />
      </span>
      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">{title}</p>
        )}
        {description && (
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="shrink-0 h-7 w-7 -mt-1 -me-1 inline-flex items-center justify-center rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
      >
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}
