"use client";

import Icon from "../Icon";
import { cn } from "./cn";

/**
 * Tag — a removable / clickable pill. Larger touch target than Badge.
 */
export default function Tag({
  children,
  onClick,
  onRemove,
  selected = false,
  icon,
  className,
}) {
  const Element = onClick ? "button" : "span";
  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-sm font-medium border transition-colors duration-150",
        selected
          ? "bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]"
          : "bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)]",
        onClick && "cursor-pointer active:scale-[.98]",
        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
        className
      )}
    >
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove"
          className="ms-1 -me-1 h-5 w-5 inline-flex items-center justify-center rounded-full hover:bg-black/10"
        >
          <Icon name="close" className="h-3 w-3" />
        </button>
      )}
    </Element>
  );
}
