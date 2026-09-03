/**
 * The checkbox box itself: size, border, radius, and the `data-state="checked"` fill.
 *
 * Shared because `Combobox`'s multi-select rows need the same box but cannot use the
 * `Checkbox` component. A Radix `Checkbox.Root` renders a real `<button>`, and nesting an
 * interactive control inside a cmdk `role="option"` row would take the row's own click and
 * muddle the listbox semantics. Those rows render a presentational `<span>` with these
 * classes and set `data-state` themselves — which is why the checked styling keys off the
 * attribute rather than a prop.
 */
export const checkboxBoxClassName =
  "size-5 shrink-0 rounded-[var(--radius-xs)] border border-input bg-background/50 transition data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground";
