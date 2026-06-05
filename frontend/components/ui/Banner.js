"use client";

import Icon from "../Icon";
import { cn } from "./cn";

const TONE = {
  info: {
    bg: "bg-[var(--color-info-bg)]",
    border: "border-[var(--color-info-border)]",
    fg: "text-[var(--color-info)]",
    icon: "info",
  },
  success: {
    bg: "bg-[var(--color-success-bg)]",
    border: "border-[var(--color-success-border)]",
    fg: "text-[var(--color-success)]",
    icon: "checkCircle",
  },
  warning: {
    bg: "bg-[var(--color-warning-bg)]",
    border: "border-[var(--color-warning-border)]",
    fg: "text-[var(--color-warning)]",
    icon: "alertCircle",
  },
  danger: {
    bg: "bg-[var(--color-danger-bg)]",
    border: "border-[var(--color-danger-border)]",
    fg: "text-[var(--color-danger)]",
    icon: "alertTriangle",
  },
  neutral: {
    bg: "bg-[var(--color-surface-muted)]",
    border: "border-[var(--color-border)]",
    fg: "text-[var(--color-text)]",
    icon: "info",
  },
};

export default function Banner({
  tone = "info",
  title,
  children,
  icon,
  action,
  onDismiss,
  className,
}) {
  const t = TONE[tone] || TONE.info;
  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        t.bg,
        t.border,
        className
      )}
    >
      <span className={cn("shrink-0 mt-0.5", t.fg)}>
        <Icon name={icon || t.icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        {title && (
          <p className={cn("text-sm font-semibold", t.fg)}>{title}</p>
        )}
        {children && (
          <div className={cn("text-sm mt-0.5", title ? "text-[var(--color-text)]" : t.fg)}>
            {children}
          </div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn(
            "shrink-0 -mt-1 -me-1 h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors",
            t.fg,
            "hover:bg-black/5"
          )}
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
