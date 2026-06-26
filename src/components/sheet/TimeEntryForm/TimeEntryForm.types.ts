import type { ComboboxOption } from "@/src/components/ui/Combobox";

export type TimeEntryFormValue = {
  projectId: string;
  date?: Date;
  hours: number;
  description: string;
  billable: boolean;
};

export type TimeEntryFormLabels = {
  title?: string;
  description?: string;
  project?: string;
  date?: string;
  hours?: string;
  note?: string;
  billable?: string;
  submit?: string;
  cancel?: string;
};

export type TimeEntryFormProps = {
  projects: ComboboxOption[];
  value?: Partial<TimeEntryFormValue>;
  labels?: TimeEntryFormLabels;
  disabled?: boolean;
  className?: string;
  onValueChange?: (value: TimeEntryFormValue) => void;
  onSubmit?: (value: TimeEntryFormValue) => void;
  onCancel?: () => void;
};
