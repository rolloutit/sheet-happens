import type { HTMLAttributes } from "react";

export type SkeletonVariant = "line" | "block" | "card" | "circle" | "table" | "chart" | "document";

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  variant?: SkeletonVariant;
  lines?: number;
};
