"use client";

import Icon from "../Icon";
import Card from "./Card";
import Stat from "./Stat";
import { cn } from "./cn";

const ACCENT = {
  primary:   { bg: "bg-[var(--color-primary-100)]",   fg: "text-[var(--color-primary-700)]" },
  secondary: { bg: "bg-[var(--color-secondary-100)]", fg: "text-[var(--color-secondary-700)]" },
  accent:    { bg: "bg-[var(--color-accent-100)]",    fg: "text-[var(--color-accent-700)]" },
  success:   { bg: "bg-[var(--color-success-bg)]",    fg: "text-[var(--color-success)]" },
  warning:   { bg: "bg-[var(--color-warning-bg)]",    fg: "text-[var(--color-warning)]" },
  danger:    { bg: "bg-[var(--color-danger-bg)]",     fg: "text-[var(--color-danger)]" },
};

export default function MetricCard({
  icon,
  label,
  value,
  unit,
  hint,
  trend,
  accent = "primary",
  href,
  className,
}) {
  const tint = ACCENT[accent] || ACCENT.primary;

  return (
    <Card
      href={href}
      interactive={Boolean(href)}
      padding="md"
      className={cn("flex items-start gap-4", className)}
    >
      {icon && (
        <div
          className={cn(
            "h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-xl",
            tint.bg,
            tint.fg
          )}
        >
          <Icon name={icon} className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Stat value={value} unit={unit} label={label} hint={hint} trend={trend} size="md" />
      </div>
    </Card>
  );
}
