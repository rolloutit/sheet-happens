"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import type {
  DrawerContentElement,
  DrawerContentProps,
  DrawerDescriptionProps,
  DrawerFooterProps,
  DrawerHeaderProps,
  DrawerOverlayProps,
  DrawerTitleProps,
} from "./Drawer.types";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerPortal = DialogPrimitive.Portal;

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  DrawerOverlayProps
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-scrim backdrop-blur-[2px]", className)}
    {...props}
  />
));
DrawerOverlay.displayName = "DrawerOverlay";

export const DrawerContent = React.forwardRef<DrawerContentElement, DrawerContentProps>(
  ({ className, side = "right", children, ...props }, ref) => (
    <DrawerPortal>
      <DrawerOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed z-50 grid gap-4 border-border bg-popover p-6 text-popover-foreground shadow-panel outline-none",
          side === "right" && "inset-y-0 right-0 w-[min(34rem,100vw)] border-l",
          side === "left" && "inset-y-0 left-0 w-[min(34rem,100vw)] border-r",
          side === "bottom" && "inset-x-0 bottom-0 rounded-t-[var(--radius-xl)] border-t",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DrawerPortal>
  ),
);
DrawerContent.displayName = "DrawerContent";

export function DrawerHeader({ className, ...props }: DrawerHeaderProps) {
  return <div className={cn("grid gap-2 pr-10", className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: DrawerFooterProps) {
  return <div className={cn("mt-auto flex justify-end gap-2", className)} {...props} />;
}

export const DrawerTitle = DialogPrimitive.Title as React.FC<DrawerTitleProps>;
export const DrawerDescription = DialogPrimitive.Description as React.FC<DrawerDescriptionProps>;
