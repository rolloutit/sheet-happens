import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

export type SegmentItem = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  count?: number;
  /**
   * The key that selects this segment, shown as a small `kbd` chip after the label and hidden
   * below `lg`. Decorative reinforcement of a shortcut that exists anyway — it is `aria-hidden`, so
   * the radio's accessible name stays the label alone.
   */
  shortcut?: string;
  /** A leading glyph, for segments whose meaning is a shape (a list, a grid) as much as a word. */
  icon?: LucideIcon;
};

export type SegmentedControlIndicator = "static" | "slide";

export type SegmentedControlProps = Omit<HTMLAttributes<HTMLDivElement>, "onChange"> & {
  items: SegmentItem[];
  value: string;
  onValueChange?: (value: string) => void;
  label: string;
  size?: "sm" | "md";
  orientation?: "horizontal" | "vertical";
  width?: "auto" | "full";
  /**
   * How the selection is drawn. `static` paints the selected segment; `slide` puts one shared
   * `layoutId` thumb behind the radios that travels to the new selection on a spring — the
   * difference between "a different pill lit up" and "the selection moved". Opt-in, because the
   * slide only animates inside a Motion feature boundary and callers outside one gain nothing.
   */
  indicator?: SegmentedControlIndicator;
  /**
   * The thumb's `layoutId`. Defaults to a per-instance id; pass one when the thumb should be
   * addressable, or when two controls must never hand the thumb to each other.
   */
  indicatorId?: string;
};
