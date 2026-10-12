import type { OrgBranding } from "@/src/lib/branding";

/**
 * `auto` follows the palette. `onDark` pins the light ink for surfaces that stay dark in both
 * themes — the auth panel's teal gradient, where a dark mark would all but vanish.
 */
export type BrandMarkTone = "auto" | "onDark";

export interface BrandMarkProps {
  /** Rendered edge length in px. Drives the `srcset`, so keep it the painted size. */
  size?: number;
  tone?: BrandMarkTone;
  className?: string;
  /** Defaults to the deployment's `NEXT_PUBLIC_ORG_*` branding; stories and tests pass their own. */
  org?: OrgBranding;
}
