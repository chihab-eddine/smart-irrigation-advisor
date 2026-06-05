"use client";

import Link from "next/link";
import { cn } from "./cn";

const SURFACE = {
  default: "bg-[var(--color-surface)] border border-[var(--color-border)]",
  sunken:  "bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]",
  raised:  "bg-[var(--color-surface-raised)] border border-[var(--color-border)] shadow-[var(--shadow-2)]",
  flat:    "bg-[var(--color-surface)] border border-[var(--color-border-subtle)]",
  warm:    "bg-[var(--gradient-sunrise)] border border-[var(--color-secondary-200)]",
  leaf:    "bg-[var(--gradient-leaf)] border border-[var(--color-primary-200)]",
  sky:     "bg-[var(--gradient-sky)] border border-[var(--color-accent-200)]",
  invert:  "bg-[var(--color-surface-inverse)] text-[var(--color-text-inverse)] border border-transparent",
};

const PAD = {
  none: "p-0",
  sm:   "p-4",
  md:   "p-5 sm:p-6",
  lg:   "p-6 sm:p-8",
};

const RADIUS = {
  sm: "rounded-xl",
  md: "rounded-2xl",
  lg: "rounded-[28px]",
};

export default function Card({
  as,
  href,
  surface = "default",
  padding = "md",
  radius = "md",
  interactive = false,
  className,
  children,
  ...rest
}) {
  const Element = as || (href ? Link : "div");
  const cls = cn(
    SURFACE[surface],
    PAD[padding],
    RADIUS[radius],
    "shadow-[var(--shadow-1)]",
    interactive &&
      "transition-[transform,box-shadow,background-color] duration-200 " +
      "hover:shadow-[var(--shadow-2)] hover:-translate-y-[1px] " +
      "active:translate-y-0 active:shadow-[var(--shadow-1)] " +
      "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
    className
  );

  if (href) {
    return (
      <Element href={href} className={cls} {...rest}>
        {children}
      </Element>
    );
  }
  return (
    <Element className={cls} {...rest}>
      {children}
    </Element>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 mb-4", className)}>
      <div className="min-w-0">
        {title && (
          <h3 className="text-[15px] font-semibold text-[var(--color-text-strong)] tracking-tight truncate">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardFooter({ children, className }) {
  return (
    <div className={cn("mt-5 pt-4 border-t border-[var(--color-border-subtle)] flex items-center justify-between gap-3", className)}>
      {children}
    </div>
  );
}
