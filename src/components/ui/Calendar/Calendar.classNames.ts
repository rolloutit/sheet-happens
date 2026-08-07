import type { ClassNames } from "react-day-picker";

/**
 * A total restyle of react-day-picker onto the brand tokens.
 *
 * Total on purpose: `react-day-picker/style.css` is never imported, so any key left out
 * renders unstyled rather than falling back to something reasonable. Radii go through
 * `var(--radius-*)`, surfaces through `bg-secondary` / `bg-accent-soft` / `bg-primary`, and
 * focus through `ring-ring`, so the grid re-themes with everything else.
 *
 * The dropdown keys (`dropdown`, `dropdown_root`, `dropdowns`, `months_dropdown`,
 * `years_dropdown`) are deliberately absent: they are only reachable via
 * `captionLayout="dropdown"`, which renders native `<select>` elements — the exact control
 * this whole change exists to remove. Their absence is the reminder.
 */
export const calendarClassNames: Partial<ClassNames> = {
  root: "font-ui text-sm text-popover-foreground",
  months: "relative flex flex-col gap-4 sm:flex-row",
  /**
   * A definite width per month, rather than sizing to content. The grid is a `<table>` whose
   * rows are flex containers; without a fixed width the columns collapse to their content
   * and the weekday header renders as one run-on word. 17.5rem is seven 40px cells.
   */
  month: "flex w-[17.5rem] shrink-0 flex-col gap-3",

  // The nav sits across the caption row, so it must not swallow clicks on the label.
  nav: "pointer-events-none absolute inset-x-0 top-0 flex w-full items-center justify-between",
  button_previous:
    "pointer-events-auto inline-flex size-8 items-center justify-center rounded-[var(--radius-pill)] text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-40",
  button_next:
    "pointer-events-auto inline-flex size-8 items-center justify-center rounded-[var(--radius-pill)] text-muted-foreground transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-40",
  chevron: "size-4",

  month_caption: "flex h-8 items-center justify-center px-9",
  /**
   * No `capitalize` here. Intl already capitalises where the locale wants it ("June 2026"),
   * and forcing it would render the Hungarian caption "2026. Június" — Hungarian month
   * names are lowercase.
   */
  caption_label: "font-ui text-sm font-semibold text-foreground",

  month_grid: "w-full border-collapse",
  weekdays: "flex w-full",
  weekday:
    "flex-1 py-1 text-center font-ui text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
  weeks: "",
  week: "mt-1 flex w-full",
  week_number_header: "w-8",
  week_number: "text-[11px] text-muted-foreground",

  day: "group/day relative aspect-square flex-1 p-0 text-center",
  day_button:
    "flex size-full items-center justify-center rounded-[var(--radius-md)] font-ui text-sm transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none",

  today: "[&>button]:border [&>button]:border-primary/35 [&>button]:text-accent",
  selected: "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary",
  outside: "text-muted-foreground/50",
  disabled: "opacity-30",
  hidden: "invisible",

  /**
   * The range fill sits on the cell so it reads as one continuous band across the week.
   *
   * The middle days carry `selected` too, so its `bg-primary` / `text-primary-foreground`
   * would otherwise fight these rules and win or lose on stylesheet order alone. The
   * `!` overrides make the band deterministic instead — without them, mid-range days render
   * dark-on-dark in the dark theme.
   */
  range_start: "rounded-l-[var(--radius-md)] bg-accent-soft",
  range_middle:
    "rounded-none bg-accent-soft [&>button]:bg-transparent! [&>button]:text-foreground! [&>button]:hover:bg-secondary!",
  range_end: "rounded-r-[var(--radius-md)] bg-accent-soft",

  footer: "pt-2 text-xs text-muted-foreground",
};
