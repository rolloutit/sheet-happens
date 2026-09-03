"use client";

import { useState } from "react";

import type { ComboboxMultipleProps, ComboboxSingleProps } from "./Combobox.types";

/** The cardinality-dependent props, kept as a union so the discriminant still narrows. */
export type ComboboxSelectionProps =
  | Pick<ComboboxSingleProps, "multiple" | "value" | "defaultValue" | "onValueChange">
  | Pick<ComboboxMultipleProps, "multiple" | "value" | "defaultValue" | "onValueChange">;

export type ComboboxSelection = {
  /** Chosen values. Single mode holds exactly one entry, multi holds zero or more. */
  values: readonly string[];
  /** Replaces the value in single mode, toggles membership in multi. */
  toggle: (value: string) => void;
  clear: () => void;
  /** Whether picking an option should close the panel. */
  closeOnSelect: boolean;
  /** Restores `defaultValue`, for `useFormReset`. */
  reset: () => void;
};

/**
 * Normalizes single and multi selection into one array-shaped model.
 *
 * `Combobox` renders one list, one trigger and one hidden form control for both
 * cardinalities. Only three things legitimately depend on `multiple` — what `defaultValue`
 * normalizes to, what `onValueChange` emits, and whether a pick closes the panel — so they
 * live here rather than branching through the component and growing it a second render path.
 *
 * Single mode deliberately keeps the empty string as a value instead of reading it as
 * "nothing chosen". It is what every "All …" filter option carries, and the trigger has to
 * render that option's label as a real choice rather than as placeholder text.
 */
export function useComboboxSelection(props: ComboboxSelectionProps): ComboboxSelection {
  const defaultValues = getDefaultValues(props);
  const controlledValues = getControlledValues(props);
  const [internalValues, setInternalValues] = useState(defaultValues);
  const values = controlledValues ?? internalValues;

  function emit(next: readonly string[]) {
    if (controlledValues === undefined) setInternalValues(next);

    if (props.multiple) props.onValueChange?.([...next]);
    else props.onValueChange?.(next[0] ?? "");
  }

  return {
    values,
    closeOnSelect: !props.multiple,
    toggle: (value) => {
      if (!props.multiple) {
        emit([value]);
        return;
      }

      emit(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
    },
    // Single mode's unset value is the empty string, not an empty list — see above. Nothing
    // calls this in single mode today, but the invariant holds here rather than at the one
    // call site that happens to gate the button on `multiple`.
    clear: () => emit(props.multiple ? [] : [""]),
    reset: () => setInternalValues(defaultValues),
  };
}

function getDefaultValues(props: ComboboxSelectionProps): readonly string[] {
  if (props.multiple) return props.defaultValue ?? [];

  return [props.defaultValue ?? ""];
}

function getControlledValues(props: ComboboxSelectionProps): readonly string[] | undefined {
  if (props.multiple) return props.value;

  return props.value === undefined ? undefined : [props.value];
}
