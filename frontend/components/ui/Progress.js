"use client";

import { cn } from "./cn";

const TONE = {
  primary: "bg-[var(--color-primary-500)]",
  success: "bg-[var(--color-success)]",
  warning: "bg-[var(--color-warning)]",
  danger:  "bg-[var(--color-danger)]",
  accent:  "bg-[var(--color-accent-500)]",
};

export default function Progress({
  value = 0,
  max = 100,
  tone = "primary",
  label,
  showValue = false,
  size = "md",
  className,
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const heights = { sm: "h-1", md: "h-2", lg: "h-3" };

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}</span>
          )}
          {showValue && (
            <span className="text-xs font-semibold text-[var(--color-text-strong)] num">
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          "w-full rounded-full overflow-hidden bg-[var(--color-surface-sunken)]",
          heights[size]
        )}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500 ease-out", TONE[tone])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
