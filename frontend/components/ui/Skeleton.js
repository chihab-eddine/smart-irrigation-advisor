"use client";

import { cn } from "./cn";

/**
 * Skeleton — shimmer placeholder. Use generously instead of spinners
 * for above-the-fold content so the layout never jumps on data arrival.
 */
export default function Skeleton({
  width,
  height,
  shape = "rect",
  className,
}) {
  const style = {};
  if (width != null) style.width = typeof width === "number" ? `${width}px` : width;
  if (height != null) style.height = typeof height === "number" ? `${height}px` : height;

  const shapeCls =
    shape === "circle"
      ? "rounded-full aspect-square"
      : shape === "text"
        ? "rounded-md h-4"
        : "rounded-md";

  return <div aria-hidden="true" className={cn("skeleton", shapeCls, className)} style={style} />;
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? "60%" : "100%"}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn("rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4", className)}>
      <div className="flex items-center gap-3">
        <Skeleton width={44} height={44} shape="circle" />
        <div className="flex-1 space-y-2">
          <Skeleton height={14} width="40%" />
          <Skeleton height={12} width="60%" />
        </div>
      </div>
      <Skeleton height={56} />
      <SkeletonText lines={2} />
    </div>
  );
}
