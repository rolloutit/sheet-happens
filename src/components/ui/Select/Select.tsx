"use client";

import { Combobox } from "../Combobox";
import { SelectMenu } from "./SelectMenu";
import type { SelectProps } from "./Select.types";

/**
 * The option count above which `searchable: "auto"` turns the search field on.
 *
 * Exported so call sites and tests reference one number rather than restating it. Eight is
 * where a menu stops being scannable at a glance: every closed enum in this app (statuses,
 * roles, profiles, project types) sits at or under it, while the lists people actually hunt
 * through — currencies, timezones, projects, members — are far above.
 */
export const defaultSearchThreshold = 8;

/**
 * A single-select that grows a search field when the list gets long.
 *
 * Dispatches to a Radix menu below the threshold and to `Combobox` above it. The switch is
 * deliberately invisible from the outside: both paths honour `name`, `defaultValue`,
 * `required`, `invalid`, `id`, `aria-describedby`, return focus to the trigger on close,
 * follow `form.reset()`, and render the same trigger surface. Reach for `Combobox` directly
 * only when a list must always be searchable regardless of how few options it has today.
 *
 * The count has to be decided here rather than at the call site because several lists are
 * data-driven — a tenant with six projects and one with sixty use the same JSX.
 */
export function Select({
  searchable = "auto",
  searchThreshold = defaultSearchThreshold,
  labels,
  modal,
  label,
  "aria-label": ariaLabel,
  ...props
}: SelectProps) {
  const useSearch =
    searchable === true || (searchable !== false && props.options.length > searchThreshold);

  if (!useSearch) {
    return <SelectMenu {...props} label={label} aria-label={ariaLabel} />;
  }

  return (
    <Combobox
      {...props}
      // Combobox requires a name for its trigger; Select allows either spelling.
      label={ariaLabel ?? label ?? ""}
      labels={labels}
      modal={modal}
    />
  );
}
