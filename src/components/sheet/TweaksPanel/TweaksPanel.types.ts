export type TweaksDensity = "compact" | "comfortable";
export type TweaksFont = "lexend" | "system";

export type TweaksPanelValue = {
  radius: number;
  denseTables: boolean;
  density: TweaksDensity;
  font: TweaksFont;
  accent: string;
  panelWidth: number;
};

export type TweaksPanelLabels = {
  open?: string;
  title?: string;
  description?: string;
  reset?: string;
  radius?: string;
  denseTables?: string;
  density?: string;
  compact?: string;
  comfortable?: string;
  font?: string;
  accent?: string;
  panelWidth?: string;
  apply?: string;
};

export type TweaksPanelProps = {
  open?: boolean;
  value?: Partial<TweaksPanelValue>;
  accentOptions?: string[];
  labels?: TweaksPanelLabels;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  onValueChange?: (value: TweaksPanelValue) => void;
  onReset?: (value: TweaksPanelValue) => void;
  onApply?: (value: TweaksPanelValue) => void;
};
