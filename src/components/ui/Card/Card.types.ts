import type { HTMLAttributes } from "react";

export type CardVariant = "flat" | "elevated" | "featured" | "warning" | "selected";
export type CardDensity = "sm" | "md" | "lg";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  density?: CardDensity;
  clickable?: boolean;
};

export type CardSectionProps = HTMLAttributes<HTMLDivElement>;
export type CardHeadingProps = HTMLAttributes<HTMLHeadingElement>;
export type CardTextProps = HTMLAttributes<HTMLParagraphElement>;
