"use client";

import { forwardRef, useId } from "react";
import Icon from "../Icon";
import { cn } from "./cn";

const BASE =
  "w-full bg-[var(--color-surface)] " +
  "text-[var(--color-text-strong)] placeholder:text-[var(--color-text-subtle)] " +
  "border border-[var(--color-border-strong)] rounded-xl px-3.5 py-3 text-[15px] " +
  "transition-[border-color,box-shadow,background-color] duration-150 " +
  "focus:border-[var(--color-primary-500)] focus:outline-none focus:shadow-[var(--shadow-focus)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "resize-y min-h-[120px] " +
  "aria-invalid:border-[var(--color-danger)] aria-invalid:focus:shadow-[var(--shadow-focus-danger)]";

const Textarea = forwardRef(function Textarea(
  { id, label, hint, error, className, required, rows = 5, ...rest },
  ref
) {
  const autoId = useId();
  const inputId = id || autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-err` : undefined;

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--color-text-strong)] mb-1.5"
        >
          {label}
          {required && <span className="text-[var(--color-danger)] ms-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={cn(hintId, errorId) || undefined}
        required={required}
        className={BASE}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-[var(--color-danger)] flex items-center gap-1">
          <Icon name="alertCircle" className="h-3.5 w-3.5" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-[var(--color-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
});

export default Textarea;
