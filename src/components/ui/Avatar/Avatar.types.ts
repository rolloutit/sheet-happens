import type { HTMLAttributes } from "react";

export type AvatarSize = "sm" | "md" | "lg" | "xl";
export type AvatarTone = "teal" | "amber" | "deep" | "peach" | "muted";

export type AvatarProps = HTMLAttributes<HTMLDivElement> & {
  name: string;
  initials?: string;
  src?: string;
  size?: AvatarSize;
  tone?: AvatarTone;
};
