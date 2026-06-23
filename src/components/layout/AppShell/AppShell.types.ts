import type { ReactNode } from "react";

export type AppShellProps = {
  children: ReactNode;
  current?: string;
  role?: "employee" | "contractor" | "admin";
  collapsed?: boolean;
};
