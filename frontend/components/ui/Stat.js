"use client";

import Icon from "../Icon";
import { cn } from "./cn";

/**
 * Stat — a labelled number. The atomic unit of a metric.
 */
export default function Stat({
  value,
  unit,
  label,
  hint,
  trend,
  size = "md",
  align = "start",
  className,
}) {
  const valueSize = {
    sm: "text-2xl",
    md: "text-3xl sm:text-4xl",
    lg: "text-5xl sm:text-6xl",
    xl: "text-6xl sm:text-7xl",
  }[size];

  return (
    <div className={cn(align === "center" && "text-center", className)}>
      {label && (
        <div className="text-xs uppercase tracking-wider font-medium text-[var(--color-text-muted)]">
          {label}
        </div>
      )}
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn("font-semibold tracking-tight text-[var(--color-text-strong)] num", valueSize)}>
          {value}
        </span>
        {unit && (
          <span className="text-base font-medium text-[var(--color-text-muted)]">{unit}</span>
        )}
        {trend && (
          <span
            className={cn(
              "ml-1 inline-flex items-center gap-0.5 text-xs font-medium",
              trend.direction === "up"
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            )}
          >
            <Icon
              name={trend.direction === "up" ? "trendingUp" : "trendingDown"}
              className="h-3.5 w-3.5"
            />
            {trend.label}
          </span>
        )}
      </div>
      {hint && (
        <div className="mt-1 text-sm text-[var(--color-text-muted)]">{hint}</div>
      )}
    </div>
  );
}
