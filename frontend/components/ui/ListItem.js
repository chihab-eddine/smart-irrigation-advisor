"use client";

import Link from "next/link";
import Icon from "../Icon";
import { cn } from "./cn";

/**
 * ListItem — iOS-style settings/list row. Tappable, with leading icon,
 * trailing chevron/value, and optional description.
 */
export default function ListItem({
  href,
  onClick,
  as,
  icon,
  iconBg = "primary",
  title,
  description,
  trailing,
  showChevron = true,
  destructive = false,
  className,
}) {
  const ICON_BG = {
    primary:   "bg-[var(--color-primary-100)]   text-[var(--color-primary-700)]",
    secondary: "bg-[var(--color-secondary-100)] text-[var(--color-secondary-700)]",
    accent:    "bg-[var(--color-accent-100)]    text-[var(--color-accent-700)]",
    neutral:   "bg-[var(--color-surface-sunken)] text-[var(--color-text)]",
    danger:    "bg-[var(--color-danger-bg)]      text-[var(--color-danger)]",
  };

  const Element = as || (href ? Link : onClick ? "button" : "div");
  const interactive = Boolean(href || onClick);

  return (
    <Element
      href={href}
      onClick={onClick}
      type={Element === "button" ? "button" : undefined}
      className={cn(
        "w-full text-left rtl:text-right flex items-center gap-3 px-4 py-3.5",
        "transition-colors duration-150",
        interactive && "active:bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-muted)]",
        "focus-visible:outline-none focus-visible:bg-[var(--color-surface-muted)]",
        className
      )}
    >
      {icon && (
        <span
          className={cn(
            "shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-xl",
            destructive ? ICON_BG.danger : ICON_BG[iconBg]
          )}
        >
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
      <div className="flex-1 min-w-0">
        {title && (
          <p
            className={cn(
              "text-[15px] font-medium truncate",
              destructive ? "text-[var(--color-danger)]" : "text-[var(--color-text-strong)]"
            )}
          >
            {title}
          </p>
        )}
        {description && (
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{description}</p>
        )}
      </div>
      {trailing && <span className="shrink-0 text-sm text-[var(--color-text-muted)]">{trailing}</span>}
      {interactive && showChevron && (
        <Icon
          name="chevronRight"
          className="shrink-0 h-4 w-4 text-[var(--color-text-subtle)] rtl-flip"
        />
      )}
    </Element>
  );
}

export function List({ children, className }) {
  return (
    <div
      className={cn(
        "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden",
        "divide-y divide-[var(--color-border-subtle)]",
        className
      )}
    >
      {children}
    </div>
  );
}
