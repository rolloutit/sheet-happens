import type { ComboboxOption } from "@/src/components/ui/Combobox";

export type TimeGridTimerLabels = {
  project?: string;
  description?: string;
  start?: string;
  stop?: string;
  reset?: string;
};

export type TimeGridTimerProps = {
  projectOptions: ComboboxOption[];
  projectValue?: string;
  descriptionValue?: string;
  elapsedLabel?: string;
  running?: boolean;
  labels?: TimeGridTimerLabels;
  onProjectChange?: (value: string) => void;
  onDescriptionChange?: (value: string) => void;
  onStart?: () => void;
  onStop?: () => void;
  onReset?: () => void;
  className?: string;
};
