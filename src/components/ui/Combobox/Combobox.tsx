"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useRef, useState } from "react";

import { cn } from "@/src/lib/utils";
import { Button } from "../Button";
import { checkboxBoxClassName } from "../Checkbox";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "../Command";
import { Popover, PopoverContent, PopoverTrigger } from "../Popover";
import { controlPanelClassName, controlTriggerClassName } from "../controlSurface";
import type { ComboboxOption, ComboboxProps } from "./Combobox.types";
import { useComboboxSelection } from "./useComboboxSelection";
import { useFormReset } from "./useFormReset";

/**
 * A searchable select, single by default and multi under `multiple`.
 *
 * Deliberately has no clear button in single mode. Every call site is either a filter, which
 * carries an explicit "All …" option, or a required field; adding one would mean a second
 * button inside the trigger button, which is invalid markup, or a floating overlay that
 * collides with the chevron. `DatePicker` keeps its clear affordance, where optional end
 * dates make it earn its place. Multi mode has nowhere to put an "All …" option — an empty
 * selection *is* that state — so there the panel grows a clear action of its own.
 *
 * Both cardinalities share one render path; see `useComboboxSelection` for why.
 */
export function Combobox(props: ComboboxProps) {
  const {
    options,
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
    multiple,
    "aria-describedby": ariaDescribedBy,
  } = props;

  const generatedId = useId();
  const triggerId = id ?? `combobox-${generatedId}`;
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<string>();
  // Passed the whole props object rather than destructured fields: that is what keeps the
  // `multiple` discriminant correlated with the value and callback types, which a rebuilt
  // object literal would lose.
  const selection = useComboboxSelection(props);
  const { values } = selection;

  const selectedIndex = options.findIndex((option) => values.includes(option.value));
  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label);
  /**
   * Past the first choice the trigger shows a count, not chips. It is a fixed-height control
   * from `controlSurface.ts`, and every filter screen already renders the chosen values as
   * removable chips under the bar (`FilterChips`), so chips in here would both overflow the
   * button and say the same thing twice. The full list stays reachable as the `title`.
   */
  const summary =
    multiple && values.length > 1
      ? (labels?.selected?.(values.length) ?? `${values.length} selected`)
      : selectedLabels[0];

  useFormReset(trigger, selection.reset);

  /**
   * cmdk identifies items by value and lowercases them, so an option whose real value is an
   * empty string (every "All …" filter) or one that differs from a sibling only by case
   * would break. Index surrogates sidestep both; search runs on keywords regardless.
   */
  const itemValue = (index: number) => `option-${index}`;

  function selectOption(next: string) {
    selection.toggle(next);
    if (selection.closeOnSelect) setOpen(false);
  }

  return (
    <div className={cn("relative min-w-0", className)}>
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
              title={selectedLabels.join(", ") || undefined}
              className={cn(
                "min-w-0 flex-1 truncate text-left",
                summary === undefined && "text-muted-foreground",
              )}
            >
              {summary ?? placeholder ?? label}
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
                <ComboboxItem
                  key={option.value}
                  option={option}
                  itemValue={itemValue(index)}
                  multiple={Boolean(multiple)}
                  selected={values.includes(option.value)}
                  onSelect={() => selectOption(option.value)}
                />
              ))}
            </CommandList>
          </Command>
          {/*
            Outside `Command` on purpose: a cmdk item would be filtered away by the search
            query, and this action has to stay reachable whatever is typed.
          */}
          {multiple && values.length > 0 ? (
            <div className="mt-2 flex justify-end border-t border-border pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={selection.clear}>
                {labels?.clear ?? "Clear"}
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      {name ? (
        <ComboboxFormValue
          {...{ name, form, required, disabled, options }}
          multiple={Boolean(multiple)}
          values={values}
          onFocus={() => trigger?.focus()}
        />
      ) : null}
    </div>
  );
}

/**
 * One option row.
 *
 * In multi mode the chosen state rides on `aria-checked` rather than `aria-selected`: cmdk
 * hardcodes `aria-selected` for its active descendant (see the note on `Command`), so that
 * attribute cannot also carry selection. `role="option"` accepts `aria-checked`, and cmdk
 * spreads incoming props before setting its own, so it survives.
 *
 * The box is a presentational `<span>` rather than the `Checkbox` component, which renders a
 * Radix root — a real `<button>`. An interactive control nested inside an option would take
 * the row's click. Both share `checkboxBoxClassName` so they cannot drift apart.
 */
function ComboboxItem({
  option,
  itemValue,
  multiple,
  selected,
  onSelect,
}: {
  option: ComboboxOption;
  itemValue: string;
  multiple: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={itemValue}
      keywords={[
        option.label,
        typeof option.meta === "string" ? option.meta : undefined,
        ...(option.keywords ?? []),
      ].filter((keyword): keyword is string => Boolean(keyword))}
      disabled={option.disabled}
      aria-checked={multiple ? selected : undefined}
      // cmdk hands back its lowercased copy, so the caller closes over the real value.
      onSelect={onSelect}
    >
      {multiple ? (
        <span
          aria-hidden="true"
          data-state={selected ? "checked" : "unchecked"}
          className={cn(checkboxBoxClassName, "flex items-center justify-center")}
        >
          {selected ? <Check className="size-3.5" /> : null}
        </span>
      ) : null}
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-medium" title={option.label}>
          {option.label}
        </span>
        {option.meta ? (
          <span className="truncate text-xs text-muted-foreground">{option.meta}</span>
        ) : null}
      </span>
      {!multiple && selected ? (
        <Check className="size-4 shrink-0 text-accent" aria-hidden="true" />
      ) : null}
    </CommandItem>
  );
}

/**
 * Mirrors Radix Select's hidden native select rather than using `<input type="hidden">`.
 *
 * Hidden inputs are barred from constraint validation, so `required` on one is silently
 * inert. A visually hidden but still laid-out `<select>` keeps native validation, native
 * form participation, and `form.reset()`.
 *
 * In multi mode it also settles the URL contract for free: a native `<select multiple>`
 * serializes as one repeated parameter per chosen value, which is exactly what the filter
 * parsers read back.
 */
function ComboboxFormValue({
  name,
  form,
  required,
  disabled,
  options,
  multiple,
  values,
  onFocus,
}: {
  name: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  options: ComboboxProps["options"];
  multiple: boolean;
  values: readonly string[];
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
      multiple={multiple}
      value={multiple ? [...values] : (values[0] ?? "")}
      onChange={() => {}}
      onFocus={onFocus}
      className="pointer-events-none absolute size-px overflow-hidden opacity-0"
    >
      {/*
        Single mode needs somewhere for an unset value to land. In multi mode an empty
        selection already means unset, and an empty-valued option would be a real choice.
      */}
      {multiple || options.some((option) => option.value === "") ? null : <option value="" />}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
