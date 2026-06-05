"use client";

import { forwardRef, useId } from "react";
import Icon from "../Icon";
import { cn } from "./cn";

const SIZE = {
  sm: "h-9 text-sm rounded-[10px] px-3",
  md: "h-12 text-[15px] rounded-xl px-3.5",
  lg: "h-14 text-base rounded-xl px-4",
};

const PADDING_WITH_ICON = {
  sm: "ps-9",
  md: "ps-11",
  lg: "ps-12",
};

const ICON_POS = {
  sm: "left-2.5",
  md: "left-3",
  lg: "left-3.5",
};

const BASE =
  "w-full bg-[var(--color-surface)] " +
  "text-[var(--color-text-strong)] placeholder:text-[var(--color-text-subtle)] " +
  "border border-[var(--color-border-strong)] " +
  "transition-[border-color,box-shadow,background-color] duration-150 " +
  "focus:border-[var(--color-primary-500)] focus:outline-none focus:shadow-[var(--shadow-focus)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "aria-invalid:border-[var(--color-danger)] aria-invalid:focus:shadow-[var(--shadow-focus-danger)]";

/**
 * Input — text input with optional label, leading icon, hint and error.
 * For non-text inputs use the matching primitive (Textarea, Select).
 */
const Input = forwardRef(function Input(
  {
    id,
    label,
    hint,
    error,
    leadingIcon,
    size = "md",
    type = "text",
    className,
    required = false,
    ...rest
  },
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
        {leadingIcon && (
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] rtl:left-auto rtl:right-3",
              ICON_POS[size]
            )}
          >
            <Icon name={leadingIcon} className="h-[18px] w-[18px]" />
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          required={required}
          className={cn(
            BASE,
            SIZE[size],
            leadingIcon && PADDING_WITH_ICON[size],
            leadingIcon && "rtl:pe-11 rtl:ps-3.5"
          )}
          {...rest}
        />
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

export default Input;
