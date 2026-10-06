export type ShortcutRow = {
  /** The keys, one chip each — `["K", "["]` renders as two alternatives. */
  keys: string[];
  label: string;
};

export type ShortcutGroup = {
  id: string;
  title: string;
  rows: ShortcutRow[];
};

export type ShortcutSheetLabels = {
  title: string;
  description: string;
  close: string;
  keyHeader: string;
  actionHeader: string;
};

export type ShortcutSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ShortcutGroup[];
  labels: ShortcutSheetLabels;
};
