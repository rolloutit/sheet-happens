export type PeriodTotalStatusTone = "warning" | "success" | "muted";

export type PeriodTotalStatus = {
  tone: PeriodTotalStatusTone;
  /** Words first, colour second — `over 8 h`, `on target`. Never a bare coloured number. */
  label: string;
};

export type PeriodTotalProps = {
  /** The figure alone, already formatted — `36` or `36:30`. */
  figure: string;
  /** The unit rendered muted after the figure — `h`. Omit when the figure carries its own. */
  unit?: string;
  /** What the figure is the total of — `this week`, `today`. */
  caption: string;
  /**
   * The figure's value, so a change can settle in the direction it moved. Never rendered; the
   * displayed text is always `figure`.
   */
  minutes: number;
  status?: PeriodTotalStatus | null;
  /** A second, quieter line — `14 of 22 workdays`. */
  secondary?: string | null;
  size?: "md" | "lg";
  align?: "start" | "end";
  className?: string;
};
