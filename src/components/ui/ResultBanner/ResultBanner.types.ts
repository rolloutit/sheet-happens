import type { ReactNode } from "react";

export type ResultBannerTone = "success" | "error" | "warning" | "info";

export type ResultBannerProps = {
  tone: ResultBannerTone;
  children: ReactNode;
  /** Renders a dismiss button when provided. */
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
};
