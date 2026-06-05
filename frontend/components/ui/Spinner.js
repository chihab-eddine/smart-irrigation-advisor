"use client";

import { cn } from "./cn";

const SIZE = {
  xs: "h-3 w-3 border-2",
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-7 w-7 border-[3px]",
  xl: "h-10 w-10 border-4",
};

export default function Spinner({ size = "md", className, label }) {
  return (
    <span
      role="status"
      aria-label={label || "Loading"}
      className={cn(
        "inline-block rounded-full animate-spin-slow",
        "border-current border-r-transparent border-b-transparent",
        "text-[var(--color-primary-500)]",
        SIZE[size],
        className
      )}
    />
  );
}
