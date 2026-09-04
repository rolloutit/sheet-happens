import type { DurationDisplayFormat } from "@/src/lib/formatting";

export type DeclaredHoursProject = {
  projectId: string;
  name: string;
  color: string;
};

/** The uploaded proof PDF, already named and sized for display by the caller. */
export type DeclaredHoursProof = {
  filename: string;
  /** Where the PDF opens. A route, not a signed URL — the caller owns access. */
  href: string;
  /** Already formatted through `src/lib/formatting`; this component does no locale work. */
  sizeLabel: string;
  uploadedAtLabel: string;
};

export type DeclaredHoursRowLabels = {
  /**
   * The hours input's accessible name, which §15 requires to name the project — `"Nimbus, declared
   * hours"`, not `"Hours"`. A band of rows all labelled "Hours" tells a screen reader user nothing.
   */
  hoursLabel: (project: DeclaredHoursProject) => string;
  hoursPlaceholder: string;
  hoursHint: string;
  noteLabel: (project: DeclaredHoursProject) => string;
  notePlaceholder: string;
  noteRequired: string;
  proofLabel: string;
  proofUpload: string;
  proofReplace: string;
  proofView: string;
  proofMissing: string;
  /** Why the proof slot is not offered yet: nothing has been declared for it to prove. */
  proofNeedsHours: string;
  proofUploading: string;
  save: string;
  saving: string;
  saved: string;
  /** Why the row is read-only. */
  locked: string;
  /** Nothing declared yet, shown in place of a figure on the locked variant. */
  nothingDeclared: string;
  externalSystem: string;
};

export type DeclaredHoursRowProps = {
  project: DeclaredHoursProject;
  /** The saved figure, or `null` when nothing has been declared for this month yet. */
  minutes: number | null;
  note: string;
  proof: DeclaredHoursProof | null;
  locale: string;
  durationDisplayFormat: DurationDisplayFormat;
  labels: DeclaredHoursRowLabels;
  /**
   * Locked by a submitted timesheet: read-only, with the figure, the note and the proof still
   * legible. Contractors only — an employee's declared hours are editable indefinitely, which is
   * the asymmetry §3 records and accepts.
   */
  locked?: boolean;
  /** A pending mutation, which disables every affordance that would start another. */
  disabled?: boolean;
  saving?: boolean;
  uploading?: boolean;
  /** Set for one render after a successful save, so the row can confirm it. */
  savedAt?: number | null;
  /** The implausible-figure warning (§4), already worded. Shown, never blocking. */
  warning?: string | null;
  /** A failed save or upload, already worded. */
  error?: string | null;
  className?: string;
  onSave: (input: { projectId: string; minutes: number; note: string }) => void;
  onUploadProof: (input: { projectId: string; file: File }) => void;
};
