"use client";

import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

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
  invalid,
  className,
  id,
  "aria-describedby": ariaDescribedBy,
  ...props
}: ComboboxProps) {
  const generatedId = useId();
  const triggerId = id ?? `combobox-${generatedId}`;
  const listboxId = `${triggerId}-listbox`;
  const searchId = `${triggerId}-search`;
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState<string>();
  const selected = options.find((option) => option.value === value);
  const visibleOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, query]);
  const enabledOptions = useMemo(
    () => visibleOptions.filter((option) => !option.disabled),
    [visibleOptions],
  );
  const activeValueIsEnabled = activeValue
    ? enabledOptions.some((option) => option.value === activeValue)
    : false;
  const selectedValueIsEnabled = selected
    ? enabledOptions.some((option) => option.value === selected.value)
    : false;
  const resolvedActiveValue = activeValueIsEnabled
    ? activeValue
    : selectedValueIsEnabled
      ? selected?.value
      : enabledOptions[0]?.value;
  const activeOptionIndex = visibleOptions.findIndex(
    (option) => option.value === resolvedActiveValue,
  );
  const activeOptionId =
    activeOptionIndex >= 0 ? `${listboxId}-option-${activeOptionIndex}` : undefined;

  useEffect(() => {
    if (!resolvedActiveValue) return;
    optionRefs.current.get(resolvedActiveValue)?.scrollIntoView({ block: "nearest" });
  }, [resolvedActiveValue]);

  function focusSearch(optionValue?: string) {
    setActiveValue(optionValue);
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }

  function firstEnabledOption() {
    return enabledOptions[0];
  }

  function moveActiveOption(direction: 1 | -1) {
    if (enabledOptions.length === 0) return;
    const currentIndex = enabledOptions.findIndex((option) => option.value === resolvedActiveValue);
    const nextIndex =
      currentIndex >= 0
        ? (currentIndex + direction + enabledOptions.length) % enabledOptions.length
        : 0;
    setActiveValue(enabledOptions[nextIndex]?.value);
  }

  function selectOption(optionValue: string) {
    if (options.find((option) => option.value === optionValue)?.disabled) return;
    onValueChange?.(optionValue);
    setOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => document.getElementById(triggerId)?.focus());
  }

  return (
    <div className={className} {...props}>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setQuery("");
            setActiveValue(undefined);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={triggerId}
            type="button"
            variant="soft"
            className="w-full justify-between"
            disabled={disabled}
            aria-label={label}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-describedby={ariaDescribedBy}
            aria-invalid={invalid || undefined}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                focusSearch(
                  selected && !selected.disabled ? selected.value : firstEnabledOption()?.value,
                );
              }
            }}
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
              id={searchId}
              ref={searchRef}
              role="searchbox"
              aria-label={searchPlaceholder}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveValue(undefined);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveActiveOption(1);
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveActiveOption(-1);
                }
                if (event.key === "Enter" && resolvedActiveValue) {
                  event.preventDefault();
                  selectOption(resolvedActiveValue);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                  window.requestAnimationFrame(() => document.getElementById(triggerId)?.focus());
                }
              }}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent font-ui text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="mt-2 grid max-h-64 gap-1 overflow-auto"
          >
            {visibleOptions.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              visibleOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = option.value === resolvedActiveValue;
                return (
                  <button
                    key={option.value}
                    id={`${listboxId}-option-${index}`}
                    ref={(node) => {
                      if (node) optionRefs.current.set(option.value, node);
                      else optionRefs.current.delete(option.value);
                    }}
                    type="button"
                    tabIndex={-1}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    disabled={option.disabled}
                    onMouseEnter={() => {
                      if (!option.disabled) setActiveValue(option.value);
                    }}
                    onClick={() => {
                      selectOption(option.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        moveActiveOption(1);
                      }
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        moveActiveOption(-1);
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        setOpen(false);
                        window.requestAnimationFrame(() =>
                          document.getElementById(triggerId)?.focus(),
                        );
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-[var(--radius-md)] px-3 py-2 text-left text-sm transition hover:bg-secondary disabled:pointer-events-none disabled:opacity-45",
                      isActive && "bg-secondary text-foreground",
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
