import { Search } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import type { CommandPillProps } from "./CommandPill.types";

export const CommandPill = React.forwardRef<HTMLButtonElement, CommandPillProps>(
  (
    {
      label = "Go anywhere...",
      shortcut = "Cmd+K",
      status,
      icon: Icon = Search,
      className,
      type = "button",
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex h-9 min-w-72 items-center gap-2 rounded-[var(--radius-pill)] border border-border bg-card px-3 text-left text-sm text-muted-foreground shadow-soft transition hover:border-accent/45 hover:text-foreground disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {status ? (
        <span className="rounded bg-accent-soft px-1.5 py-0.5 font-ui text-[9px] font-bold uppercase text-accent">
          {status}
        </span>
      ) : null}
      {shortcut ? (
        <kbd className="rounded bg-secondary px-1.5 py-0.5 font-ui text-[10px] font-semibold">
          {shortcut}
        </kbd>
      ) : null}
    </button>
  ),
);
CommandPill.displayName = "CommandPill";
