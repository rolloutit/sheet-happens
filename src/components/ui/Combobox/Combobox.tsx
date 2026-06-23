"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/src/lib/utils";
import { Button } from "../Button";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";
import type { ComboboxProps } from "./Combobox.types";

export function Combobox({
  options,
  value,
  onValueChange,
  label,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyLabel = "No results",
  disabled,
  className,
  ...props
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);

  return (
    <div className={className} {...props}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="soft"
            className="w-full justify-between"
            disabled={disabled}
            aria-label={label}
          >
            <span className={cn(!selected && "text-muted-foreground")}>
              {selected?.label ?? placeholder}
            </span>
            <ChevronsUpDown className="size-4 opacity-70" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-2">
          <div className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-input bg-card px-3">
            <Search className="size-4 text-muted-foreground" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent font-ui text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="mt-2 grid max-h-64 gap-1 overflow-auto">
            {visibleOptions.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              visibleOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => {
                      onValueChange?.(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-45",
                      isSelected && "bg-primary/14 text-accent",
                    )}
                  >
                    <span className="grid gap-0.5">
                      <span className="font-medium">{option.label}</span>
                      {option.meta ? (
                        <span className="text-xs text-muted-foreground">{option.meta}</span>
                      ) : null}
                    </span>
                    {isSelected ? <Check className="size-4" aria-hidden="true" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
