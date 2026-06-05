"use client";

import Icon from "../Icon";
import { cn } from "./cn";

const VARIANT = {
  neutral: "bg-[var(--color-surface-sunken)] text-[var(--color-text)] border-[var(--color-border)]",
  primary: "bg-[var(--color-primary-100)] text-[var(--color-primary-800)] border-[var(--color-primary-200)]",
  secondary: "bg-[var(--color-secondary-100)] text-[var(--color-secondary-800)] border-[var(--color-secondary-200)]",
  accent: "bg-[var(--color-accent-100)] text-[var(--color-accent-800)] border-[var(--color-accent-200)]",
  success: "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]",
  warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]",
  danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info-border)]",
};

const SIZE = {
  sm: "h-5 px-2 text-[11px] rounded-md gap-1",
  md: "h-6 px-2.5 text-xs rounded-md gap-1",
  lg: "h-7 px-3 text-sm rounded-lg gap-1.5",
};

export default function Badge({
  variant = "neutral",
  size = "md",
  icon,
  children,
  className,
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium border whitespace-nowrap",
        VARIANT[variant],
        SIZE[size],
        className
      )}
    >
      {icon && <Icon name={icon} className="h-3 w-3" />}
      {children}
    </span>
  );
}
