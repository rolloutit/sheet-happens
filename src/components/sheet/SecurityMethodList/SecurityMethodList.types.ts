import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type SecurityMethodState = "set" | "connected" | "not_enabled" | "recommended";

export type SecurityMethod = {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  state: SecurityMethodState;
  stateLabel?: ReactNode;
  icon?: LucideIcon;
  actionLabel?: ReactNode;
  disabled?: boolean;
};

export type SecurityMethodListProps = {
  title?: string;
  description?: ReactNode;
  methods: SecurityMethod[];
  onMethodAction?: (method: SecurityMethod) => void;
  className?: string;
};
