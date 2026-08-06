import Image from "next/image";

import { cn } from "@/src/lib/utils";
import type { BrandMarkProps } from "./BrandMark.types";

/** The logo is Rollout IT's, not the app's, so the alt text says something the wordmark does not. */
const brandName = "Rollout IT";

/** The pictogram carries no palette of its own, so each surface needs its own ink. */
const marks = {
  /** For dark surfaces: the dark palette, which `:root` holds, and every `onDark` caller. */
  cream: "/brand/rolloutit-mark-light.png",
  /** For light surfaces: the `.light` palette. */
  teal: "/brand/rolloutit-mark-blue.png",
} as const;

/**
 * Rollout IT pictogram.
 *
 * On `auto`, both files sit in the markup and CSS picks one. Reading `useTheme()` instead would make
 * this a client component that renders neither mark on the server and then swaps the right one in
 * after hydration — a flash on every load, to re-decide what `dark:` already settles before first
 * paint. `loading="eager"` because the hidden branch is `display:none`, so a lazy image would only
 * start downloading once the user flips the theme.
 */
export function BrandMark({ size = 40, tone = "auto", className }: BrandMarkProps) {
  const shared = cn("shrink-0 select-none", className);
  // `alt` stays out of the spread: jsx-a11y cannot see through one, and reads it as missing.
  const imageProps = { width: size, height: size, loading: "eager" } as const;

  if (tone === "onDark") {
    return <Image src={marks.cream} alt={brandName} {...imageProps} className={shared} />;
  }

  return (
    <>
      <Image
        src={marks.teal}
        alt={brandName}
        {...imageProps}
        className={cn(shared, "block dark:hidden")}
      />
      <Image
        src={marks.cream}
        alt={brandName}
        {...imageProps}
        className={cn(shared, "hidden dark:block")}
      />
    </>
  );
}
