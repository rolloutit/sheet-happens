import Image from "next/image";

import { orgBranding } from "@/src/lib/branding";
import { cn } from "@/src/lib/utils";
import type { BrandMarkProps } from "./BrandMark.types";

/**
 * Sheet Happens' own pictogram, shown when the deployment configures no organisation logo. It
 * draws in `currentColor`, so one component serves every surface and the tone only picks the ink.
 */
function DefaultMark({ size, className }: { size: number; className: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="16" cy="16" r="12.5" />
      <path d="M16 8.5V16l5 3" />
    </svg>
  );
}

/**
 * The organisation's logo when the deployment sets one, otherwise the product's own mark.
 *
 * On `auto`, both variants sit in the markup and CSS picks one. Reading `useTheme()` instead would
 * make this a client component that renders neither mark on the server and then swaps the right
 * one in after hydration — a flash on every load, to re-decide what `dark:` already settles before
 * first paint. `loading="eager"` because the hidden branch is `display:none`, so a lazy image would
 * only start downloading once the user flips the theme. `unoptimized` because the logo may be an
 * SVG or live on a host `next.config` knows nothing about.
 */
export function BrandMark({
  size = 40,
  tone = "auto",
  className,
  org = orgBranding,
}: BrandMarkProps) {
  const shared = cn("shrink-0 select-none", className);

  if (!org.logo || !org.logoDark) {
    const ink = tone === "onDark" ? "text-[#eafbfa]" : "text-primary";

    return <DefaultMark size={size} className={cn(shared, ink)} />;
  }

  // `alt` stays out of the spread: jsx-a11y cannot see through one, and reads it as missing.
  const alt = org.name ?? "";
  const imageProps = { width: size, height: size, loading: "eager", unoptimized: true } as const;

  if (tone === "onDark") {
    return <Image src={org.logoDark} alt={alt} {...imageProps} className={shared} />;
  }

  return (
    <>
      <Image src={org.logo} alt={alt} {...imageProps} className={cn(shared, "block dark:hidden")} />
      <Image
        src={org.logoDark}
        alt={alt}
        {...imageProps}
        className={cn(shared, "hidden dark:block")}
      />
    </>
  );
}
