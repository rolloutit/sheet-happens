import type { KeyboardEvent } from "react";

export type SuggestOption = {
  /** The text that is accepted into the field, verbatim. */
  text: string;
  /** A quiet second line — `12 times · last used Sep 3`. */
  meta?: string;
  /**
   * Group key. Options are rendered in the order given and a heading is drawn wherever the key
   * changes, so the caller controls grouping by sorting; a key with no entry in `labels.groups`
   * renders without a heading.
   */
  group?: string;
};

export type SuggestInputLabels = {
  /** Accessible name of the option list. */
  list: string;
  /** The live region's readout — `(3) => "3 suggestions"`. */
  count: (count: number) => string;
  /** Stands in for the list when a query matches none of the options. */
  empty: string;
  /** A quiet key hint below the list. */
  hint?: string;
  /** Heading per `group` value. */
  groups?: Record<string, string>;
};

/**
 * `auto` picks `popover` on a wide viewport and `block` below it.
 *
 * `block` renders the list in flow under the field instead of floating over the layout: on a phone
 * the composer is already a bottom sheet, and a panel floating over a virtual keyboard is a trap.
 */
export type SuggestInputLayout = "auto" | "popover" | "block";

export type SuggestInputProps = {
  /** `textarea` for the entry dialog's three-row description. */
  as?: "input" | "textarea";
  /** The free text. Controlled — accepting an option is an ordinary value change. */
  value: string;
  onValueChange: (value: string) => void;
  /**
   * Fired when an option is accepted, and only then: Enter on the active option, or a click.
   * Never on blur, never on a keystroke. The value change is reported through `onValueChange` as
   * usual, so a caller that does not care which option it was can ignore this.
   */
  onAccept?: (option: SuggestOption) => void;
  /** Already ranked and already scoped by the caller. This component only filters and renders. */
  options: readonly SuggestOption[];
  labels: SuggestInputLabels;
  /**
   * How many options to offer on focus while the field is still empty — the zero-keystroke state
   * that makes this read as "the app remembers" rather than as an autocomplete. `0` turns it off.
   */
  emptyStateLimit?: number;
  /** How many filtered options to render at once. Defaults to 6 floating, 4 in flow. */
  visibleLimit?: number;
  layout?: SuggestInputLayout;
  /**
   * The field element, for a caller that has to move focus itself.
   *
   * The entry dialog needs it: its focus trap claims focus in an effect of its own, so the only way
   * to land in the description instead is to focus it from a later effect in the same component.
   */
  fieldRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
  id?: string;
  name?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  className?: string;
  fieldClassName?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  /**
   * Called after this component's own key handling, and skipped when it consumed the event — so a
   * caller can add keys without having to know which ones the list has already claimed.
   */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur?: () => void;
};
