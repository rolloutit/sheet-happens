import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

export type CommandPillProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label?: string;
  shortcut?: string;
  status?: string;
  icon?: LucideIcon;
};
