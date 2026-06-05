"use client";

import { useTheme } from "../ThemeProvider";
import Icon from "../Icon";
import { cn } from "./cn";

export default function ThemeToggle({ className, compact = false }) {
  const { theme, resolved, setTheme } = useTheme();

  const cycle = () => {
    const order = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const icon = theme === "system" ? "settings" : resolved === "dark" ? "sun" : "cloud";
  const label =
    theme === "system" ? "System" : resolved === "dark" ? "Dark" : "Light";

  if (compact) {
    return (
      <button
        type="button"
        onClick={cycle}
        aria-label={`Theme: ${label}`}
        title={`Theme: ${label}`}
        className={cn(
          "h-10 w-10 inline-flex items-center justify-center rounded-full",
          "text-[var(--color-text-strong)] hover:bg-[var(--color-surface-muted)]",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
          className
        )}
      >
        <Icon name={resolved === "dark" ? "sun" : "cloud"} className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        "inline-flex items-center gap-2 h-10 px-3 rounded-full",
        "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-strong)]",
        "text-sm font-medium hover:bg-[var(--color-surface-muted)] transition-colors",
        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
        className
      )}
      aria-label={`Theme: ${label}`}
    >
      <Icon name={resolved === "dark" ? "sun" : "cloud"} className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
