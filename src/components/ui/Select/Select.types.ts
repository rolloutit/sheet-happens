import type { ComponentPropsWithoutRef } from "react";
import type { Select as SelectPrimitive } from "radix-ui";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SelectProps = Omit<
  ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
  "children"
> & {
  id?: string;
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
};
