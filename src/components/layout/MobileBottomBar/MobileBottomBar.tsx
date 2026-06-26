"use client";

import { cn } from "@/src/lib/utils";
import type { MobileBottomBarProps } from "./MobileBottomBar.types";

export function MobileBottomBar({
  items,
  current,
  label = "Mobile navigation",
  onNavigate,
  className,
  ...props
}: MobileBottomBarProps) {
  return (
    <nav
      aria-label={label}
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-panel backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      <div className="grid grid-cols-4 gap-1">
        {items.slice(0, 4).map((item) => {
          const active = item.id === current;
          const Icon = item.icon;
          const itemClassName = cn(
            "grid min-w-0 justify-items-center gap-1 rounded-[var(--radius-md)] px-2 py-1.5 text-xs font-medium text-muted-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active && "bg-accent/15 text-accent",
            item.disabled && "pointer-events-none opacity-45",
          );
          const content = (
            <>
              <span className="relative">
                <Icon className="size-5" aria-hidden="true" />
                {item.badge ? (
                  <span className="absolute -right-2 -top-1 rounded-[var(--radius-pill)] bg-cta px-1 font-ui text-[9px] font-bold text-cta-foreground">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </>
          );

          if (item.href) {
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={itemClassName}
                onClick={(event) => {
                  if (item.disabled) return;
                  if (onNavigate) event.preventDefault();
                  onNavigate?.(item.id);
                }}
              >
                {content}
              </a>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              aria-current={active ? "page" : undefined}
              className={itemClassName}
              onClick={() => onNavigate?.(item.id)}
            >
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
