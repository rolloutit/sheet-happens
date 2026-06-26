"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CommandPill } from "@/src/components/layout/CommandPill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/Dialog";
import { Input } from "@/src/components/ui/Input";
import { cn } from "@/src/lib/utils";
import type { CommandPaletteItem, CommandPaletteProps } from "./CommandPalette.types";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function matchesItem(item: CommandPaletteItem, query: string) {
  if (!query) return true;
  const haystack = [
    item.label,
    item.description,
    item.group,
    item.shortcut,
    ...(item.keywords ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function groupItems(items: CommandPaletteItem[]) {
  return items.reduce<Record<string, CommandPaletteItem[]>>((groups, item) => {
    const group = item.group ?? "General";
    groups[group] = [...(groups[group] ?? []), item];
    return groups;
  }, {});
}

export function CommandPalette({
  items,
  open,
  defaultOpen,
  labels,
  trigger,
  className,
  onOpenChange,
  onSelect,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const filteredItems = useMemo(() => {
    const normalizedQuery = normalize(query);
    return items.filter((item) => matchesItem(item, normalizedQuery));
  }, [items, query]);
  const groups = groupItems(filteredItems);

  function selectItem(item: CommandPaletteItem) {
    if (item.disabled) return;
    onSelect?.(item);
    onOpenChange?.(false);
  }

  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <CommandPill label={labels?.trigger ?? "Go anywhere..."} shortcut="Cmd+K" />}
      </DialogTrigger>
      <DialogContent className={cn("max-w-2xl p-0", className)}>
        <DialogHeader className="border-b border-border p-5 pb-4">
          <DialogTitle>{labels?.title ?? "Command palette"}</DialogTitle>
          <DialogDescription>
            {labels?.description ?? "Search people, projects, reports, and actions."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 p-5">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              aria-label={labels?.search ?? "Search commands"}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
              placeholder={labels?.search ?? "Search commands"}
            />
          </div>
          {filteredItems.length === 0 ? (
            <div
              className="rounded-[var(--radius-lg)] border border-dashed border-border p-6 text-center text-sm text-muted-foreground"
              role="status"
            >
              {labels?.empty ?? "No commands found"}
            </div>
          ) : (
            <div className="max-h-[24rem] overflow-y-auto" role="listbox" aria-label="Commands">
              {Object.entries(groups).map(([group, groupItems]) => (
                <section key={group} className="grid gap-1 py-2 first:pt-0">
                  <h3 className="px-2 font-ui text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </h3>
                  {groupItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        disabled={item.disabled}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45"
                        onClick={() => selectItem(item)}
                      >
                        <span className="grid size-8 place-items-center rounded-[var(--radius-md)] bg-secondary text-accent">
                          {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
                        </span>
                        <span className="grid min-w-0 gap-0.5">
                          <span className="truncate text-sm font-semibold">{item.label}</span>
                          {item.description ? (
                            <span className="truncate text-xs text-muted-foreground">
                              {item.description}
                            </span>
                          ) : null}
                        </span>
                        {item.shortcut ? (
                          <kbd className="rounded bg-secondary px-1.5 py-0.5 font-ui text-[10px] font-semibold text-muted-foreground">
                            {item.shortcut}
                          </kbd>
                        ) : null}
                      </button>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
