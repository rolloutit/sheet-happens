import type { ComponentPropsWithoutRef } from "react";
import type { DropdownMenu as DropdownPrimitive } from "radix-ui";

export type DropdownContentProps = ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>;
export type DropdownItemTone = "default" | "danger";
export type DropdownItemProps = ComponentPropsWithoutRef<typeof DropdownPrimitive.Item> & {
  tone?: DropdownItemTone;
};
export type DropdownCheckboxItemProps = ComponentPropsWithoutRef<
  typeof DropdownPrimitive.CheckboxItem
> & {
  tone?: DropdownItemTone;
};
export type DropdownRadioGroupProps = ComponentPropsWithoutRef<typeof DropdownPrimitive.RadioGroup>;
export type DropdownRadioItemProps = ComponentPropsWithoutRef<
  typeof DropdownPrimitive.RadioItem
> & {
  tone?: DropdownItemTone;
};
export type DropdownLabelProps = ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>;
export type DropdownSeparatorProps = ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>;
