"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import { useState } from "react";

import { cn } from "@/src/lib/utils";
import { useFormReset } from "../Combobox";
import { controlTriggerClassName } from "../controlSurface";
import type { SelectMenuProps } from "./Select.types";

/**
 * The non-searchable path behind `Select`: a Radix menu with native typeahead.
 *
 * Holds the value in state even when the caller is uncontrolled, rather than handing
 * `defaultValue` to Radix and forgetting it. That is what lets `useFormReset` restore the
 * trigger on `form.reset()`, and it keeps this path behaviourally identical to the
 * `Combobox` path — the whole point of `Select` being able to switch between them.
 */
export function SelectMenu({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  form,
  label,
  placeholder,
  disabled,
  required,
  invalid,
  className,
  triggerClassName,
  contentClassName,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: SelectMenuProps) {
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const currentValue = value ?? internalValue;

  useFormReset(trigger, () => setInternalValue(defaultValue ?? ""));

  return (
    <SelectPrimitive.Root
      value={currentValue}
      onValueChange={(next) => {
        if (value === undefined) setInternalValue(next);
        onValueChange?.(next);
      }}
      name={name}
      required={required}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        ref={setTrigger}
        form={form}
        aria-label={ariaLabel ?? label}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        className={cn(controlTriggerClassName, className, triggerClassName)}
      >
        {/* Radix's `Select.Value` drops `className`, so the truncation has to live on a
            wrapper — without it a label longer than the trigger wraps to a second line and
            overflows the fixed `h-10` control. */}
        <span
          className="min-w-0 flex-1 truncate text-left"
          title={options.find((option) => option.value === currentValue)?.label}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          className={cn(
            "z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius-lg)] border border-border-strong bg-popover p-1 font-ui text-popover-foreground shadow-panel",
            contentClassName,
          )}
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                // Keep native typeahead matching the label, not the secondary line.
                textValue={option.label}
                className="relative flex cursor-default select-none items-center rounded-[var(--radius-md)] py-2 pl-9 pr-3 text-sm outline-none transition focus:bg-secondary data-[disabled]:pointer-events-none data-[disabled]:opacity-45"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-3 inline-flex items-center">
                  <Check className="size-4 text-accent" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>
                  {option.meta ? (
                    <span className="grid gap-0.5">
                      <span title={option.label}>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.meta}</span>
                    </span>
                  ) : (
                    <span title={option.label}>{option.label}</span>
                  )}
                </SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
