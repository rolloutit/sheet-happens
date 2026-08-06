"use client";

import { useId, type CSSProperties } from "react";

import { FormMessage } from "@/src/components/ui/FormMessage";
import { cn } from "@/src/lib/utils";
import {
  DEFAULT_PROJECT_COLOR_TOKEN,
  getProjectColorLabel,
  projectColorOptions,
  projectColorValues,
  type ProjectColorToken,
} from "@/src/lib/project-colors";

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
            <span className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground transition peer-checked:border-primary peer-checked:bg-accent-soft peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
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

export function ProjectColorSwatch({
  colorToken,
  size = "md",
  className,
}: {
  colorToken: ProjectColorToken;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
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
