import type { ComboboxLabels } from "@/src/components/ui/Combobox";

export type TimerStartProject = {
  projectId: string;
  name: string;
  color: string;
};

export type TimerStartDialogLabels = {
  title: string;
  description: string;
  close: string;
  cancel: string;
  start: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  projectLabel: string;
  recent: string;
  combobox: ComboboxLabels;
};

export type TimerStartDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: readonly TimerStartProject[];
  /** Rendered as one-tap chips above the picker. Only the first few are shown. */
  recentProjects?: readonly TimerStartProject[];
  labels: TimerStartDialogLabels;
  /** True while the start action is in flight. */
  pending?: boolean;
  /** Message from a rejected start. Keeps the dialog open so the input is not lost. */
  error?: string | null;
  onStart: (projectId: string, description: string) => void;
};
