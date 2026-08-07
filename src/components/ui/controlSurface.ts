/**
 * The shared surface for controls that open a panel: the `Select` trigger, the `Combobox`
 * trigger, and the `DatePicker` / `DateRangePicker` / `MonthPicker` triggers.
 *
 * Extracted rather than copied because `Select` dispatches between a Radix menu and a cmdk
 * combobox depending on how many options it has. If the two triggers drifted, an
 * eight-option filter and a nine-option one would render as visibly different controls for
 * a reason no user could see.
 *
 * Uses `focus:` rather than `focus-visible:` to match Radix's Select trigger, which takes
 * focus on pointer-down and so shows its ring on click.
 */
export const controlTriggerClassName =
  "inline-flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-input bg-surface-inset px-3 font-ui text-sm text-foreground shadow-inner outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-55 data-[placeholder]:text-muted-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/30";

/**
 * Keeps a popover panel the width of the control that opened it, with a floor so a narrow
 * filter in a table header still has room for a search field and option labels.
 */
export const controlPanelClassName = "w-[var(--radix-popover-trigger-width)] min-w-64 p-2";
