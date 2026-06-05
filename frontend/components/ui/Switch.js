"use client";

import { useId } from "react";
import { cn } from "./cn";

export default function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
  description,
  id,
  className,
}) {
  const autoId = useId();
  const inputId = id || autoId;

  return (
    <label
      htmlFor={inputId}
      className={cn(
        "flex items-start justify-between gap-4 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <span className="flex-1">
        {label && (
          <span className="block text-[15px] font-medium text-[var(--color-text-strong)]">
            {label}
          </span>
        )}
        {description && (
          <span className="block text-sm text-[var(--color-text-muted)] mt-0.5">{description}</span>
        )}
      </span>
      <span className="relative shrink-0 mt-0.5">
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <span
          className={cn(
            "block w-11 h-6 rounded-full transition-colors duration-200",
            "bg-[var(--color-border-strong)]",
            "peer-checked:bg-[var(--color-primary-500)]",
            "peer-focus-visible:shadow-[var(--shadow-focus)]"
          )}
        />
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm",
            "transition-transform duration-200",
            "peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5"
          )}
        />
      </span>
    </label>
  );
}
