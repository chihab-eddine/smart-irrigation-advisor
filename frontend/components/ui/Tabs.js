"use client";

import { cn } from "./cn";

/**
 * Segmented Tabs — touch-friendly segmented control.
 * Use for 2–4 mutually exclusive states. Renders a sliding-style indicator.
 *
 * items: [{ value, label, icon? }]
 */
export default function Tabs({ items, value, onChange, size = "md", className }) {
  const sizes = {
    sm: "h-9 text-sm",
    md: "h-11 text-[15px]",
    lg: "h-12 text-base",
  };
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-stretch p-1 rounded-xl bg-[var(--color-surface-sunken)] border border-[var(--color-border)]",
        sizes[size],
        className
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(it.value)}
            className={cn(
              "px-3.5 flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200",
              "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
              active
                ? "bg-[var(--color-surface)] text-[var(--color-text-strong)] shadow-[var(--shadow-1)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
