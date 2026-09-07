import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** One stop of the scope control, or one lens of the week. Presentational: the caller owns the model. */
export type TimeScopeBarOption = {
  value: string;
  label: string;
  /** The key that selects it, shown as a `kbd` chip. */
  shortcut?: string;
  icon?: LucideIcon;
  /**
   * A 4px dot after the label plus this text for assistive technology — the Month segment wears
   * it when a hybrid member's declared hours live there and nowhere on the current scope.
   */
  badge?: string;
};

export type TimeScopeBarLabels = {
  /** The scope `radiogroup`'s name — `View`. */
  view: string;
  /** `⊖`'s name for the current state — `Zoom out to Month`, or the at-the-end wording. */
  zoomOut: string;
  /** `⊕`'s name for the current state — `Zoom in to Day`, or the at-the-end wording. */
  zoomIn: string;
  /** The lens `radiogroup`'s name — `Week layout`. */
  lens: string;
};

export type TimeScopeBarShortcuts = {
  zoomOut?: string;
  zoomIn?: string;
};

export type TimeScopeBarProps = {
  scopes: TimeScopeBarOption[];
  scope: string;
  /** Whether `⊕` / `⊖` have anywhere to go. */
  canZoomIn: boolean;
  canZoomOut: boolean;
  lenses?: TimeScopeBarOption[];
  lens?: string;
  /** The lens toggle mounts only at the week scope; this is that fact, decided by the caller. */
  lensVisible?: boolean;
  labels: TimeScopeBarLabels;
  shortcuts?: TimeScopeBarShortcuts;
  /**
   * `compact` is the phone row: the scope control stretches to the full width and the zoom caps go,
   * because on a phone the two global actions move to the FAB and the header pill (§9).
   */
  density?: "comfortable" | "compact";
  /** The row's right-hand slot: the two global actions, start a timer and add an entry. */
  actions?: ReactNode;
  disabled?: boolean;
  className?: string;
  onScopeChange: (scope: string) => void;
  onLensChange?: (lens: string) => void;
  onZoom: (direction: "in" | "out") => void;
};
