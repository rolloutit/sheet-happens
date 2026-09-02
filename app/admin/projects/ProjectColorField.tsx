"use client";

import { useId } from "react";

import { FormMessage } from "@/src/components/ui/FormMessage";
import { ProjectColorSwatch } from "@/src/components/ui/ProjectColorSwatch";
import { DEFAULT_PROJECT_COLOR_TOKEN, projectColorOptions } from "@/src/lib/project-colors";
import type { ProjectColorToken } from "@/src/lib/project-colors";

// Re-exported so the existing `import { ProjectColorSwatch } from "./ProjectColorField"` call
// sites keep working. New code — anything under src/components — should import it directly from
// @/src/components/ui/ProjectColorSwatch instead, since components there can't reach into app/.
export { ProjectColorSwatch };

export type ProjectColorFieldProps = {
  name?: string;
  label?: string;
  defaultValue?: ProjectColorToken;
  error?: string;
  reserveMessageSpace?: boolean;
};

export function ProjectColorField({
  name = "colorToken",
  label = "Project color",
  defaultValue = DEFAULT_PROJECT_COLOR_TOKEN,
  error,
  reserveMessageSpace,
}: ProjectColorFieldProps) {
  const generatedId = useId();
  const messageId = error ? `${generatedId}-error` : undefined;

  return (
    <fieldset className="grid gap-2" aria-describedby={messageId}>
      <legend className="font-ui text-sm font-semibold text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {projectColorOptions.map((option) => (
          <label key={option.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              className="peer sr-only"
              aria-label={option.label}
            />
            {/* The radio is `sr-only`, so the global focus outline would land on a clipped 1px box.
                This span is its visible proxy and carries the same outline instead — as an outline
                rather than a border brighten, so it cannot collide with `peer-checked:border-*`. */}
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition peer-checked:border-primary peer-checked:bg-accent-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
              <ProjectColorSwatch colorToken={option.value} />
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <FormMessage id={messageId} tone="error">
          {error}
        </FormMessage>
      ) : reserveMessageSpace ? (
        <FormMessage tone="hint" className="invisible" aria-hidden="true">
          .
        </FormMessage>
      ) : null}
    </fieldset>
  );
}
