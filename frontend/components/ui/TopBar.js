"use client";

import Link from "next/link";
import Icon from "../Icon";
import { cn } from "./cn";

/**
 * TopBar — contextual mobile-first top bar.
 * Distinct from the marketing-style Navbar. Use inside authenticated screens.
 *
 * Props:
 *   title          — string, large screen heading
 *   subtitle       — string, secondary line
 *   back           — { href } | { onClick }  — leading back arrow
 *   leading        — custom leading slot (overrides back)
 *   trailing       — custom trailing slot
 *   transparent    — render with no border/bg (useful over hero)
 *   centered       — center the title (iOS style)
 */
export default function TopBar({
  title,
  subtitle,
  back,
  leading,
  trailing,
  transparent = false,
  centered = false,
  className,
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30",
        transparent
          ? "bg-transparent"
          : "bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)]",
        className
      )}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div
        className={cn(
          "h-14 px-3 flex items-center gap-2",
          centered ? "justify-center" : "justify-between"
        )}
      >
        <div className={cn("flex items-center gap-2", centered && "absolute left-3 rtl:left-auto rtl:right-3")}>
          {leading
            ? leading
            : back
              ? back.href ? (
                  <Link
                    href={back.href}
                    aria-label="Back"
                    className="h-10 w-10 inline-flex items-center justify-center rounded-full text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-surface-sunken)]"
                  >
                    <Icon name="arrowLeft" className="h-5 w-5 rtl-flip" />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={back.onClick}
                    aria-label="Back"
                    className="h-10 w-10 inline-flex items-center justify-center rounded-full text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-surface-sunken)]"
                  >
                    <Icon name="arrowLeft" className="h-5 w-5 rtl-flip" />
                  </button>
                )
              : null}
          {!centered && (
            <div className="min-w-0">
              {title && (
                <h1 className="text-[16px] font-semibold text-[var(--color-text-strong)] tracking-tight truncate">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs text-[var(--color-text-muted)] truncate">{subtitle}</p>
              )}
            </div>
          )}
        </div>
        {centered && title && (
          <h1 className="text-[16px] font-semibold text-[var(--color-text-strong)] tracking-tight truncate">
            {title}
          </h1>
        )}
        {trailing && (
          <div className={cn("flex items-center gap-1.5", centered && "absolute right-3 rtl:right-auto rtl:left-3")}>
            {trailing}
          </div>
        )}
      </div>
    </header>
  );
}
