import type { ComboboxLabels } from "@/src/components/ui/Combobox";
import type { SuggestInputLabels, SuggestOption } from "@/src/components/ui/SuggestInput";

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
  /** The description field's suggestion list. */
  suggestions: SuggestInputLabels;
};

export type TimerStartDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: readonly TimerStartProject[];
  /** Rendered as one-tap chips above the picker. Only the first few are shown. */
  recentProjects?: readonly TimerStartProject[];
  /**
   * This member's recent descriptions for the project the dialog has selected, ranked.
   *
   * The dialog opens blank by design, so this is where the zero-keystroke list earns the most:
   * restarting yesterday's task stops being a retype.
   */
  suggestions?: readonly SuggestOption[];
  labels: TimerStartDialogLabels;
  /** True while the start action is in flight. */
  pending?: boolean;
  /** Message from a rejected start. Keeps the dialog open so the input is not lost. */
  error?: string | null;
  onStart: (projectId: string, description: string) => void;
  /**
   * The project changed — from the picker or from a recent chip.
   *
   * Exists so the caller can re-scope `suggestions`: the dialog keeps its own project state (it is
   * reset by the portal unmounting), and a caller that guessed the project instead would offer
   * another one's descriptions.
   */
  onProjectChange?: (projectId: string) => void;
};
