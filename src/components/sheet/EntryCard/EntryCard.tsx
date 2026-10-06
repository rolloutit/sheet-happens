"use client";

import { AlertTriangle, Lock, Pencil, Play, ShieldCheck, Trash2 } from "lucide-react";

import { cn } from "@/src/lib/utils";
import type { EntryCardProps } from "./EntryCard.types";
import { entryCardVariants } from "./EntryCard.variants";

/**
 * One time entry, at two densities (§5.8 of `docs/time-view-redesign.md`).
 *
 * ```
 * ▌ Internal dashboard updates                              4.25 h
 * ▌ Internal Ops & Tooling · 09:00 – 13:15                ✎  ▷  🗑
 * ```
 *
 * Line 1 is the description, `--foreground`, one line with an ellipsis in the Week column and
 * wrapping in the Day row; line 2 is the context, muted. The duration sits right-aligned in
 * tabular numerals so a column of cards lines its figures up.
 *
 * The actions reveal on hover and on `:focus-within`, 140ms of opacity — they are always in the tab
 * order and always rendered, so a keyboard user reaches them without knowing they were hidden and
 * a screen reader never meets a `display: none`. On a coarse pointer there is no hover, so they
 * stay visible. Continue starts a timer with this card's project and description.
 */
export function EntryCard({
  entry,
  durationLabel,
  density = "compact",
  labels,
  disabled = false,
  highlightToken = null,
  canContinue = true,
  className,
  children,
  onEdit,
  onDelete,
  onContinue,
}: EntryCardProps) {
  const warningText = entry.warnings.join(" ");
  const tone = entry.locked ? "locked" : entry.warnings.length ? "warning" : "normal";
  const compact = density === "compact";
  const actionsDisabled = disabled || entry.locked;

  return (
    <div
      className={cn(entryCardVariants({ density, tone }), className)}
      style={{ borderLeftColor: entry.locked ? "var(--muted-foreground)" : entry.projectColor }}
      data-entry-id={entry.id}
    >
      {/* The saved pulse (§7.7) rides on an overlay keyed by its token, so a second save of the
          same card remounts it and the animation runs again. */}
      {highlightToken !== null ? (
        <span
          key={highlightToken}
          aria-hidden="true"
          className="sheet-saved-pulse pointer-events-none absolute inset-0 rounded-[inherit]"
        />
      ) : null}
      <div className="flex min-w-0 items-start gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 break-words text-foreground",
            compact ? "line-clamp-2 text-xs font-medium leading-snug" : "text-sm font-semibold",
          )}
          title={compact ? entry.description : undefined}
        >
          {entry.description}
        </p>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 font-ui font-semibold tabular-nums text-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {entry.timed ? (
            <Play
              role="img"
              aria-label={labels.timed}
              className="size-3 fill-current text-muted-foreground"
            />
          ) : null}
          {durationLabel}
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-muted-foreground",
            compact ? "text-[11px] leading-4" : "text-xs",
          )}
        >
          <span className="min-w-0 truncate">{entry.projectName}</span>
          {entry.startTime && entry.endTime ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 tabular-nums">
                {entry.startTime} – {entry.endTime}
              </span>
            </>
          ) : null}
          {entry.locked ? (
            <Lock role="img" aria-label={labels.locked} className="size-3 shrink-0" />
          ) : null}
          {entry.adminModified ? (
            <ShieldCheck
              role="img"
              aria-label={labels.adminModified}
              className="size-3 shrink-0 text-accent"
            />
          ) : null}
          {entry.warnings.length ? (
            <span title={warningText} className="inline-flex shrink-0">
              <AlertTriangle role="img" aria-label={warningText} className="size-3 text-warning" />
            </span>
          ) : null}
        </span>

        {/* Opacity, never `display: none`: the buttons must stay in the tab order and in the
            accessibility tree whatever the pointer is doing. In the compact card they sit over the
            tail of the meta line rather than beside it, so the project name keeps the whole width
            while nothing is hovered — three reserved buttons would squeeze it to a few letters in a
            seven-column week. A coarse pointer has no hover, so there they take their place in the
            row and stay visible. */}
        <span
          className={cn(
            "ml-auto flex shrink-0 items-center opacity-0 transition-opacity duration-[var(--duration-micro)] group-hover/card:opacity-100 group-focus-within/card:opacity-100 pointer-coarse:opacity-100",
            compact &&
              "pointer-events-none absolute bottom-1 right-1 rounded-[var(--radius-sm)] bg-background/95 pl-1 shadow-soft backdrop-blur-[2px] group-hover/card:pointer-events-auto group-focus-within/card:pointer-events-auto pointer-coarse:static pointer-coarse:pointer-events-auto pointer-coarse:bg-transparent pointer-coarse:pl-0 pointer-coarse:shadow-none",
            entry.locked && "opacity-100",
            entry.locked && compact && "pointer-events-auto",
          )}
        >
          <CardAction
            label={labels.edit(entry)}
            icon={Pencil}
            disabled={actionsDisabled}
            compact={compact}
            onClick={() => onEdit(entry)}
          />
          {onContinue && canContinue ? (
            <CardAction
              label={labels.continue(entry)}
              icon={Play}
              disabled={disabled}
              compact={compact}
              className="hover:text-accent"
              onClick={() => onContinue(entry)}
            />
          ) : null}
          <CardAction
            label={labels.delete(entry)}
            icon={Trash2}
            disabled={actionsDisabled}
            compact={compact}
            className="hover:bg-destructive-soft hover:text-destructive"
            onClick={() => onDelete(entry)}
          />
        </span>
      </div>

      {children}
    </div>
  );
}

function CardAction({
  label,
  icon: Icon,
  disabled,
  compact,
  className,
  onClick,
}: {
  label: string;
  icon: typeof Pencil;
  disabled: boolean;
  compact: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors duration-[var(--duration-micro)] hover:bg-secondary hover:text-accent disabled:cursor-not-allowed disabled:opacity-40",
        compact ? "size-7" : "size-8",
        className,
      )}
      onClick={onClick}
    >
      <Icon className={cn(compact ? "size-3.5" : "size-4")} aria-hidden="true" />
    </button>
  );
}
