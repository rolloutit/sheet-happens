import type { CSSProperties } from "react";

import { getProjectColorLabel, projectColorValues } from "@/src/lib/project-colors";
import { cn } from "@/src/lib/utils";
import type { ProjectColorSwatchProps } from "./ProjectColorSwatch.types";

/** The small colored dot that stands in for a project across tables, chips, and pickers. */
export function ProjectColorSwatch({
  colorToken,
  size = "md",
  className,
}: ProjectColorSwatchProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block shrink-0 rounded-full border border-foreground/10 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22)]",
        size === "sm" && "size-2.5",
        size === "md" && "size-3.5",
        size === "lg" && "size-9",
        className,
      )}
      title={getProjectColorLabel(colorToken)}
      style={
        {
          backgroundColor: projectColorValues[colorToken],
        } satisfies CSSProperties
      }
    />
  );
}
