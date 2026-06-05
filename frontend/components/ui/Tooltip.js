"use client";

import { useState } from "react";
import { cn } from "./cn";

/**
 * Tooltip — pure-CSS hover/focus tooltip. No portal, no positioning library.
 * Wraps `children`. Use for short hints only; for definitions prefer Sheet.
 */
export default function Tooltip({ content, children, side = "top", className }) {
  const [open, setOpen] = useState(false);

  if (!content) return children;

  const sides = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 me-2",
    right: "left-full top-1/2 -translate-y-1/2 ms-2",
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-50 px-2.5 py-1.5 rounded-md text-xs font-medium",
            "bg-[var(--color-surface-inverse)] text-[var(--color-text-inverse)] shadow-[var(--shadow-2)]",
            "whitespace-nowrap pointer-events-none animate-fade-in",
            sides[side],
            className
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
