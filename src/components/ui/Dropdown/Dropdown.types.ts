import type { ComponentPropsWithoutRef } from "react";
import type { DropdownMenu as DropdownPrimitive } from "radix-ui";

export type DropdownContentProps = ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>;
export type DropdownItemProps = ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>;
export type DropdownLabelProps = ComponentPropsWithoutRef<typeof DropdownPrimitive.Label>;
export type DropdownSeparatorProps = ComponentPropsWithoutRef<typeof DropdownPrimitive.Separator>;
