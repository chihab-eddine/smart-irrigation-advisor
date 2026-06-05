"use client";

import { forwardRef } from "react";
import Link from "next/link";
import Icon from "../Icon";
import { cn } from "./cn";

const SIZE = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-[10px]",
  md: "h-11 px-4 text-[15px] gap-2 rounded-xl",
  lg: "h-13 px-5 text-base gap-2 rounded-xl",
  xl: "h-14 px-6 text-base gap-2 rounded-2xl",
};

const ICON_SIZE = {
  sm: "h-4 w-4",
  md: "h-[18px] w-[18px]",
  lg: "h-5 w-5",
  xl: "h-5 w-5",
};

const ICON_ONLY_SIZE = {
  sm: "h-9 w-9 rounded-[10px]",
  md: "h-11 w-11 rounded-xl",
  lg: "h-13 w-13 rounded-xl",
  xl: "h-14 w-14 rounded-2xl",
};

function variantClasses(variant) {
  switch (variant) {
    case "primary":
      return "bg-[var(--color-primary-600)] text-[var(--color-text-on-primary)] hover:bg-[var(--color-primary-700)] active:bg-[var(--color-primary-800)] shadow-[var(--shadow-1)]";
    case "secondary":
      return "bg-[var(--color-surface)] text-[var(--color-text-strong)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-surface-sunken)]";
    case "tonal":
      return "bg-[var(--color-primary-100)] text-[var(--color-primary-800)] hover:bg-[var(--color-primary-200)] active:bg-[var(--color-primary-300)]";
    case "ghost":
      return "bg-transparent text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)] active:bg-[var(--color-surface-sunken)]";
    case "danger":
      return "bg-[var(--color-danger)] text-white hover:opacity-90 active:opacity-95 shadow-[var(--shadow-1)]";
    case "accent":
      return "bg-[var(--color-accent-500)] text-white hover:bg-[var(--color-accent-600)] active:bg-[var(--color-accent-700)] shadow-[var(--shadow-1)]";
    case "warm":
      return "bg-[var(--color-secondary-500)] text-white hover:bg-[var(--color-secondary-600)] active:bg-[var(--color-secondary-700)] shadow-[var(--shadow-1)]";
    default:
      return "bg-[var(--color-primary-600)] text-white hover:bg-[var(--color-primary-700)]";
  }
}

const BASE =
  "inline-flex items-center justify-center font-medium select-none whitespace-nowrap " +
  "transition-[background-color,color,box-shadow,transform] duration-150 " +
  "active:scale-[.985] " +
  "disabled:opacity-50 disabled:pointer-events-none " +
  "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]";

const Spinner = ({ size }) => (
  <svg
    className={cn("animate-spin-slow", ICON_SIZE[size])}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity=".25" />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);

const Button = forwardRef(function Button(
  {
    as,
    href,
    type = "button",
    variant = "primary",
    size = "md",
    leadingIcon,
    trailingIcon,
    iconOnly = false,
    fullWidth = false,
    loading = false,
    disabled = false,
    children,
    className,
    ...rest
  },
  ref
) {
  const Element = as || (href ? Link : "button");

  const cls = cn(
    BASE,
    iconOnly ? ICON_ONLY_SIZE[size] : SIZE[size],
    variantClasses(variant),
    fullWidth && "w-full",
    className
  );

  const content = (
    <>
      {loading ? (
        <Spinner size={size} />
      ) : leadingIcon ? (
        typeof leadingIcon === "string" ? (
          <Icon name={leadingIcon} className={ICON_SIZE[size]} />
        ) : (
          leadingIcon
        )
      ) : null}
      {!iconOnly && children ? <span>{children}</span> : null}
      {!loading && trailingIcon
        ? typeof trailingIcon === "string"
          ? <Icon name={trailingIcon} className={ICON_SIZE[size]} />
          : trailingIcon
        : null}
    </>
  );

  if (href) {
    return (
      <Element ref={ref} href={href} className={cls} aria-busy={loading || undefined} {...rest}>
        {content}
      </Element>
    );
  }

  return (
    <Element
      ref={ref}
      type={type}
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </Element>
  );
});

export default Button;
