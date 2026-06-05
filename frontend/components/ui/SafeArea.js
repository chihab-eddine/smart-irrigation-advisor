"use client";

import { cn } from "./cn";

/**
 * SafeArea — applies env(safe-area-inset-*) to a region.
 * Use `edges` to opt into specific edges. Default: top + bottom.
 */
export default function SafeArea({
  as: Element = "div",
  edges = ["top", "bottom"],
  className,
  children,
  ...rest
}) {
  const style = {
    paddingTop: edges.includes("top")    ? "env(safe-area-inset-top, 0px)"    : undefined,
    paddingBottom: edges.includes("bottom") ? "env(safe-area-inset-bottom, 0px)" : undefined,
    paddingLeft: edges.includes("left")   ? "env(safe-area-inset-left, 0px)"   : undefined,
    paddingRight: edges.includes("right") ? "env(safe-area-inset-right, 0px)"  : undefined,
  };
  return (
    <Element className={cn(className)} style={style} {...rest}>
      {children}
    </Element>
  );
}
