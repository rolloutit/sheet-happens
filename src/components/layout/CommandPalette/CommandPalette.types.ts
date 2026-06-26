import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type CommandPaletteItem = {
  id: string;
  label: string;
  description?: string;
  group?: string;
  shortcut?: string;
  keywords?: string[];
  icon?: LucideIcon;
  disabled?: boolean;
};

export type CommandPaletteLabels = {
  trigger?: string;
  title?: string;
  description?: string;
  search?: string;
  empty?: string;
};

export type CommandPaletteProps = {
  items: CommandPaletteItem[];
  open?: boolean;
  defaultOpen?: boolean;
  labels?: CommandPaletteLabels;
  trigger?: ReactNode;
  className?: string;
  onOpenChange?: (open: boolean) => void;
  onSelect?: (item: CommandPaletteItem) => void;
};
