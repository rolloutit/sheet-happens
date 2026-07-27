import type { HTMLAttributes, ReactNode } from "react";

export type AuthShellMood = "back" | "aboard" | "fresh" | "secure";

export type AuthShellProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  contentClassName?: string;
  mood?: AuthShellMood;
};
