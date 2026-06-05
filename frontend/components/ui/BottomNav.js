"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "../Icon";
import { cn } from "./cn";

/**
 * BottomNav — 5-slot mobile-first navigation.
 * Center slot is reserved for a FAB-style primary action (capture).
 * Hidden on lg+ screens (desktop uses the top Navbar).
 *
 * items: [{ key, href, label, icon, badge? }, fab, { key, href, label, icon, badge? }, ...]
 * fab:   { key, href, label, icon, onClick? }
 */
export default function BottomNav({ items = [], fab, className }) {
  const pathname = usePathname();
  const isActive = (href) => pathname === href || pathname?.startsWith(href + "/");

  // Layout: 2 items, FAB, 2 items. If items.length === 4 we render 2-FAB-2.
  // Otherwise we render items in equal slots without a FAB.
  const useFab = fab && items.length === 4;
  const left = useFab ? items.slice(0, 2) : items;
  const right = useFab ? items.slice(2) : [];

  return (
    <nav
      aria-label="Bottom navigation"
      className={cn(
        "lg:hidden fixed bottom-0 inset-x-0 z-40",
        "bg-[var(--color-surface)]/95 backdrop-blur-md",
        "border-t border-[var(--color-border)]",
        className
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid grid-cols-5 items-center h-16">
        {left.map((it) => (
          <NavItem key={it.key} item={it} active={isActive(it.href)} />
        ))}

        {useFab && (
          <div className="flex items-center justify-center">
            <Link
              href={fab.href}
              onClick={fab.onClick}
              aria-label={fab.label}
              className={cn(
                "relative -mt-7 h-14 w-14 inline-flex items-center justify-center rounded-2xl",
                "bg-[var(--color-primary-600)] text-white shadow-[var(--shadow-3)]",
                "transition-transform duration-150 active:scale-95",
                "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
              )}
            >
              <Icon name={fab.icon} className="h-6 w-6" strokeWidth={2.25} />
            </Link>
          </div>
        )}

        {right.map((it) => (
          <NavItem key={it.key} item={it} active={isActive(it.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavItem({ item, active }) {
  return (
    <Link
      href={item.href}
      onClick={item.onClick}
      className={cn(
        "relative h-full flex flex-col items-center justify-center gap-0.5",
        "transition-colors duration-150 active:opacity-70"
      )}
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center h-7 w-12 rounded-full transition-colors duration-200",
          active && "bg-[var(--color-primary-100)]"
        )}
      >
        <Icon
          name={item.icon}
          className={cn(
            "h-[22px] w-[22px]",
            active ? "text-[var(--color-primary-700)]" : "text-[var(--color-text-muted)]"
          )}
          strokeWidth={active ? 2.25 : 1.75}
        />
        {item.badge ? (
          <span className="absolute top-1.5 ms-7 inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-secondary-500)]" />
        ) : null}
      </span>
      <span
        className={cn(
          "text-[11px] font-medium",
          active ? "text-[var(--color-primary-800)]" : "text-[var(--color-text-muted)]"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}
