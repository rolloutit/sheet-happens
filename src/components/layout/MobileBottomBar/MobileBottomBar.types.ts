import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

export type MobileBottomBarItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: ReactNode;
  disabled?: boolean;
};

export type MobileBottomBarProps = Omit<HTMLAttributes<HTMLElement>, "onChange"> & {
  items: MobileBottomBarItem[];
  current?: string;
  label?: string;
  onNavigate?: (itemId: string) => void;
};
