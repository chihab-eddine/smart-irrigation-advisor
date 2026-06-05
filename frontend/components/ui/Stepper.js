"use client";

import { cn } from "./cn";

/**
 * Stepper — minimal dot progress indicator for onboarding-like flows.
 * Counts from 1. `current` is 0-indexed.
 */
export default function Stepper({ steps, current = 0, className }) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {Array.from({ length: steps }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === current
              ? "w-8 bg-[var(--color-primary-600)]"
              : i < current
                ? "w-1.5 bg-[var(--color-primary-400)]"
                : "w-1.5 bg-[var(--color-border-strong)]"
          )}
        />
      ))}
    </div>
  );
}
