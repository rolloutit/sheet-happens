import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/src/lib/utils";
import type { ButtonProps } from "./Button.types";
import { buttonVariants } from "./Button.variants";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      icon: Icon,
      loading,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot.Root : "button";
    const LeadingIcon = loading ? Loader2 : Icon;

    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>
          {children}
        </Comp>
      );
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {LeadingIcon ? (
          <LeadingIcon className={cn(loading && "animate-spin")} aria-hidden="true" />
        ) : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";
