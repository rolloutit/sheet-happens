import { cn } from "@/src/lib/utils";
import type { ListRowProps } from "./ListRow.types";

export function ListRow({
  leading,
  title,
  meta,
  trailing,
  selected,
  disabled,
  onClick,
  className,
}: ListRowProps) {
  const content = (
    <>
      {leading ? <div className="shrink-0">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate font-ui text-sm font-semibold text-foreground">{title}</div>
        {meta ? <div className="mt-1 text-sm text-muted-foreground">{meta}</div> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </>
  );
  const classes = cn(
    "flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-3 text-left transition",
    selected && "border-primary/55 bg-primary/12",
    disabled && "opacity-50",
    onClick && "hover:bg-secondary",
    className,
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} disabled={disabled}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}
