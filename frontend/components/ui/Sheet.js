"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Icon from "../Icon";
import { cn } from "./cn";

/**
 * Sheet — mobile-first bottom sheet, becomes a centered modal on desktop.
 * Closes on backdrop click, Escape, or the close button.
 */
export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  className,
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const SIZE = {
    sm: "sm:max-w-md",
    md: "sm:max-w-lg",
    lg: "sm:max-w-2xl",
    xl: "sm:max-w-3xl",
    full: "sm:max-w-5xl",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "sheet-title" : undefined}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={closeOnBackdrop ? onClose : undefined}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in"
      />
      <div
        className={cn(
          "relative w-full bg-[var(--color-surface)] shadow-[var(--shadow-3)]",
          "rounded-t-[28px] sm:rounded-2xl",
          "border border-[var(--color-border)]",
          "animate-sheet-up sm:animate-scale-in",
          "max-h-[92dvh] flex flex-col",
          SIZE[size],
          className
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Grab handle, mobile only */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="block h-1.5 w-10 rounded-full bg-[var(--color-border-strong)]" />
        </div>

        {(title || description) && (
          <div className="px-5 sm:px-6 pt-3 pb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title && (
                <h2
                  id="sheet-title"
                  className="text-lg font-semibold text-[var(--color-text-strong)] tracking-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-[var(--color-text-muted)] mt-1">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 h-9 w-9 inline-flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-strong)] transition-colors"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">{children}</div>

        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-[var(--color-border-subtle)] bg-[var(--color-surface)]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
