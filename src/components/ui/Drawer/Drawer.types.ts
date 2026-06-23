import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react";
import type { Dialog as DialogPrimitive } from "radix-ui";

export type DrawerContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: "right" | "left" | "bottom";
};
export type DrawerOverlayProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>;
export type DrawerHeaderProps = HTMLAttributes<HTMLDivElement>;
export type DrawerFooterProps = HTMLAttributes<HTMLDivElement>;
export type DrawerTitleProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Title>;
export type DrawerDescriptionProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Description>;
export type DrawerContentElement = ElementRef<typeof DialogPrimitive.Content>;
