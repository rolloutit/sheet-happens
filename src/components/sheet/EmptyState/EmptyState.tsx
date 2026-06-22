import { cn } from "@/src/lib/utils";
import type { EmptyStateProps } from "./EmptyState.types";
import { emptyStateVariants } from "./EmptyState.variants";

export function EmptyState({ icon: Icon, title, body, action, tone, className }: EmptyStateProps) {
  return (
    <section className={cn(emptyStateVariants({ tone }), className)}>
      <div className="mx-auto grid size-12 place-items-center rounded-[var(--radius-lg)] bg-secondary text-accent">
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </section>
  );
}
