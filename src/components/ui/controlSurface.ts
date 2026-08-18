import { focusChromeClassName } from "./focusRing";

/**
 * The shared surface for controls that open a panel: the `Select` trigger, the `Combobox`
 * trigger, and the `DatePicker` / `DateRangePicker` / `MonthPicker` triggers.
 *
 * Extracted rather than copied because `Select` dispatches between a Radix menu and a cmdk
 * combobox depending on how many options it has. If the two triggers drifted, an
 * eight-option filter and a nine-option one would render as visibly different controls for
 * a reason no user could see.
 *
 * Focus comes from `focusChromeClassName` — the border brightens and nothing else. This used to
 * be a `focus:` ring rather than `focus-visible:`, on the reasoning that Radix's Select trigger
 * takes focus on pointer-down and should therefore show its ring on click. That is exactly what
 * made the control feel noisy: every mouse click painted a ring the pointer user had no use for,
 * and a keyboard Tab stacked the global outline on top of it. The pointer affordance is hover;
 * the keyboard affordance is the border.
 *
 * The error state keys off both `aria-invalid` and `data-invalid`. Triggers that report a
 * widget role (`combobox`) carry `aria-invalid`; the date pickers open a dialog from a plain
 * button, where ARIA does not allow `aria-invalid`, so they set `data-invalid` and
 * communicate the error through the `Field` message via `aria-describedby`.
 */
export const controlTriggerClassName = `inline-flex h-10 min-w-0 w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-input bg-surface-inset px-3 font-ui text-sm text-foreground shadow-inner outline-none transition disabled:cursor-not-allowed disabled:opacity-55 data-[placeholder]:text-muted-foreground aria-[invalid=true]:border-destructive data-[invalid=true]:border-destructive ${focusChromeClassName}`;

/**
 * Keeps a popover panel the width of the control that opened it, with a floor so a narrow
 * filter in a table header still has room for a search field and option labels.
 */
export const controlPanelClassName = "w-[var(--radix-popover-trigger-width)] min-w-64 p-2";
