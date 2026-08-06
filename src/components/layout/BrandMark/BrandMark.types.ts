/**
 * `auto` follows the palette. `onDark` pins the cream ink for surfaces that stay dark in both
 * themes — the auth panel's teal gradient, where the deep-teal mark would all but vanish.
 */
export type BrandMarkTone = "auto" | "onDark";

export interface BrandMarkProps {
  /** Rendered edge length in px. Drives the `srcset`, so keep it the painted size. */
  size?: number;
  tone?: BrandMarkTone;
  className?: string;
}
