"use client";

import Icon from "../Icon";
import { cn } from "./cn";

export default function EmptyState({
  icon = "sprout",
  title,
  description,
  action,
  secondaryAction,
  illustration,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center px-6 py-12 sm:py-16",
        className
      )}
    >
      {illustration ? (
        illustration
      ) : (
        <div className="h-16 w-16 rounded-2xl bg-[var(--color-primary-100)] text-[var(--color-primary-700)] inline-flex items-center justify-center mb-5">
          <Icon name={icon} className="h-8 w-8" />
        </div>
      )}
      {title && (
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)] tracking-tight max-w-md">
          {title}
        </h3>
      )}
      {description && (
        <p className="mt-1.5 text-[15px] text-[var(--color-text-muted)] max-w-md">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
