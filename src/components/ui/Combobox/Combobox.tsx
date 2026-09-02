"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useRef, useState } from "react";

import { cn } from "@/src/lib/utils";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "../Command";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";
import { controlPanelClassName, controlTriggerClassName } from "../controlSurface";
import type { ComboboxProps } from "./Combobox.types";
import { useFormReset } from "./useFormReset";

/**
 * A searchable single-select.
 *
 * Deliberately has no clear button. Every call site is either a filter, which carries an
 * explicit "All …" option, or a required field; adding one would mean a second button
 * inside the trigger button, which is invalid markup, or a floating overlay that collides
 * with the chevron. `DatePicker` keeps its clear affordance, where optional end dates make
 * it earn its place.
 */
export function Combobox({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  form,
  label,
  placeholder,
  labels,
  disabled,
  required,
  invalid,
  modal = true,
  className,
  triggerClassName,
  contentClassName,
  id,
  "aria-describedby": ariaDescribedBy,
  ...props
}: ComboboxProps) {
  const generatedId = useId();
  const triggerId = id ?? `combobox-${generatedId}`;
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [activeItem, setActiveItem] = useState<string>();

  const currentValue = value ?? internalValue;
  const selectedIndex = options.findIndex((option) => option.value === currentValue);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useFormReset(trigger, () => setInternalValue(defaultValue ?? ""));

  /**
   * cmdk identifies items by value and lowercases them, so an option whose real value is an
   * empty string (every "All …" filter) or one that differs from a sibling only by case
   * would break. Index surrogates sidestep both; search runs on keywords regardless.
   */
  const itemValue = (index: number) => `option-${index}`;

  function selectOption(next: string) {
    if (value === undefined) setInternalValue(next);
    onValueChange?.(next);
    setOpen(false);
  }

  return (
    <div className={cn("relative min-w-0", className)} {...props}>
      <Popover
        open={open}
        modal={modal}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          // Highlight the current choice when opening, rather than the first row.
          if (nextOpen) setActiveItem(selectedIndex >= 0 ? itemValue(selectedIndex) : undefined);
        }}
      >
        <PopoverTrigger asChild>
          {/*
            PopoverTrigger merges in `aria-controls` at runtime, pointing at the panel id it
            generates. The rule only sees this JSX, not what Radix adds to it.
          */}
          {/* eslint-disable jsx-a11y/role-has-required-aria-props */}
          <button
            ref={setTrigger}
            id={triggerId}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={label}
            aria-describedby={ariaDescribedBy}
            aria-invalid={invalid || undefined}
            disabled={disabled}
            className={cn(controlTriggerClassName, triggerClassName)}
          >
            <span
              title={selected?.label}
              className={cn(
                "min-w-0 flex-1 truncate text-left",
                !selected && "text-muted-foreground",
              )}
            >
              {selected?.label ?? placeholder ?? label}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
          {/* eslint-enable jsx-a11y/role-has-required-aria-props */}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn(controlPanelClassName, contentClassName)}
          /**
           * Focus the search field explicitly rather than letting Radix focus the panel or
           * relying on `autoFocus`. Inside a Dialog or Drawer the surrounding focus scope
           * reclaims focus right after the panel opens and strands it on the trigger, so
           * the move has to happen on the next frame to land after that.
           */
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            window.requestAnimationFrame(() => searchRef.current?.focus());
          }}
        >
          {/* `label` names cmdk's input, which hardcodes role="combobox" like the trigger. */}
          <Command
            label={labels?.search ?? "Search"}
            value={activeItem}
            onValueChange={setActiveItem}
          >
            <CommandInput ref={searchRef} placeholder={labels?.searchPlaceholder ?? "Search..."} />
            <CommandList>
              <CommandEmpty>{labels?.empty ?? "No results"}</CommandEmpty>
              {options.map((option, index) => (
                <CommandItem
                  key={option.value}
                  value={itemValue(index)}
                  keywords={[
                    option.label,
                    typeof option.meta === "string" ? option.meta : undefined,
                    ...(option.keywords ?? []),
                  ].filter((keyword): keyword is string => Boolean(keyword))}
                  disabled={option.disabled}
                  // cmdk hands back its lowercased copy, so close over the real value.
                  onSelect={() => selectOption(option.value)}
                >
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate font-medium" title={option.label}>
                      {option.label}
                    </span>
                    {option.meta ? (
                      <span className="truncate text-xs text-muted-foreground">{option.meta}</span>
                    ) : null}
                  </span>
                  {option.value === currentValue ? (
                    <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />
                  ) : null}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {name ? (
        <ComboboxFormValue
          {...{ name, form, required, disabled, options }}
          value={currentValue}
          onFocus={() => trigger?.focus()}
        />
      ) : null}
    </div>
  );
}

/**
 * Mirrors Radix Select's hidden native select rather than using `<input type="hidden">`.
 *
 * Hidden inputs are barred from constraint validation, so `required` on one is silently
 * inert. A visually hidden but still laid-out `<select>` keeps native validation, native
 * form participation, and `form.reset()`.
 */
function ComboboxFormValue({
  name,
  form,
  required,
  disabled,
  options,
  value,
  onFocus,
}: {
  name: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  options: ComboboxProps["options"];
  value: string;
  onFocus: () => void;
}) {
  return (
    <select
      aria-hidden="true"
      tabIndex={-1}
      name={name}
      form={form}
      required={required}
      disabled={disabled}
      value={value}
      onChange={() => {}}
      onFocus={onFocus}
      className="pointer-events-none absolute size-px overflow-hidden opacity-0"
    >
      {options.some((option) => option.value === "") ? null : <option value="" />}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
