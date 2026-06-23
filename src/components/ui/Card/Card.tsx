import { cn } from "@/src/lib/utils";
import type { CardHeadingProps, CardProps, CardSectionProps, CardTextProps } from "./Card.types";
import { cardVariants } from "./Card.variants";

export function Card({ variant, density, clickable, className, ...props }: CardProps) {
  return (
    <div className={cn(cardVariants({ variant, density, clickable }), className)} {...props} />
  );
}

export function CardHeader({ className, ...props }: CardSectionProps) {
  return (
    <div className={cn("mb-4 flex items-start justify-between gap-4", className)} {...props} />
  );
}

export function CardContent({ className, ...props }: CardSectionProps) {
  return <div className={cn("grid gap-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardSectionProps) {
  return <div className={cn("mt-5 flex items-center justify-end gap-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: CardHeadingProps) {
  return <h3 className={cn("text-base font-semibold text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: CardTextProps) {
  return <p className={cn("text-sm leading-6 text-muted-foreground", className)} {...props} />;
}
