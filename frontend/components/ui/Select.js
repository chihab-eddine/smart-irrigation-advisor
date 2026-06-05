"use client";

import { forwardRef, useId } from "react";
import Icon from "../Icon";
import { cn } from "./cn";

const SIZE = {
  sm: "h-9 text-sm rounded-[10px] ps-3 pe-9",
  md: "h-12 text-[15px] rounded-xl ps-3.5 pe-11",
  lg: "h-14 text-base rounded-xl ps-4 pe-12",
};

const BASE =
  "appearance-none w-full bg-[var(--color-surface)] " +
  "text-[var(--color-text-strong)] " +
  "border border-[var(--color-border-strong)] " +
  "transition-[border-color,box-shadow,background-color] duration-150 " +
  "focus:border-[var(--color-primary-500)] focus:outline-none focus:shadow-[var(--shadow-focus)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "aria-invalid:border-[var(--color-danger)]";

const Select = forwardRef(function Select(
  { id, label, hint, error, options = [], placeholder, size = "md", className, required, children, ...rest },
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
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          required={required}
          className={cn(BASE, SIZE[size])}
          {...rest}
        >
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {children
            ? children
            : options.map((o) =>
                typeof o === "string" ? (
                  <option key={o} value={o}>{o}</option>
                ) : (
                  <option key={o.value} value={o.value}>{o.label}</option>
                )
              )}
        </select>
        <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 right-3 rtl:right-auto rtl:left-3 text-[var(--color-text-muted)]">
          <Icon name="chevronDown" className="h-4 w-4" />
        </span>
      </div>
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

export default Select;
