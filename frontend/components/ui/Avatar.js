"use client";

import { cn } from "./cn";

const SIZE = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

function initials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function Avatar({
  name,
  src,
  size = "md",
  variant = "primary",
  className,
}) {
  const VARIANTS = {
    primary: "bg-[var(--color-primary-500)] text-white",
    secondary: "bg-[var(--color-secondary-500)] text-white",
    accent: "bg-[var(--color-accent-500)] text-white",
    neutral: "bg-[var(--color-surface-sunken)] text-[var(--color-text-strong)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold uppercase shrink-0 overflow-hidden",
        SIZE[size],
        VARIANTS[variant],
        className
      )}
      aria-label={name || undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name || ""} className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
