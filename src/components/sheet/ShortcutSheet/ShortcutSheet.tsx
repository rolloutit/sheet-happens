"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/Dialog";
import type { ShortcutSheetProps } from "./ShortcutSheet.types";

/**
 * Every shortcut on `/time`, in one place, on `?` (§8 of `docs/time-view-redesign.md`).
 *
 * A `Dialog` with a `table` per group — View · Move · Add · Timer — rather than the inline legend
 * it replaces: a legend in the chrome is the wrong home for shortcuts, and a sheet is where every
 * fast calendar keeps them. The keys are real `kbd` elements so a screen reader says "K" as a key.
 */
export function ShortcutSheet({ open, onOpenChange, groups, labels }: ShortcutSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={labels.close} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 sm:grid-cols-2">
          {groups.map((group) => (
            <table key={group.id} className="w-full border-separate border-spacing-y-1 text-sm">
              <caption className="pb-1 text-left font-ui text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.title}
              </caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">{labels.keyHeader}</th>
                  <th scope="col">{labels.actionHeader}</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.label}>
                    <td className="w-28 whitespace-nowrap pr-3 align-top">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {row.keys.map((key, index) => (
                          <span key={key} className="inline-flex items-center gap-1">
                            {index > 0 ? (
                              <span className="text-[10px] text-subtle-foreground">/</span>
                            ) : null}
                            <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-[var(--radius-xs)] border border-border-strong bg-secondary px-1.5 font-ui text-[11px] font-semibold text-foreground shadow-[inset_0_-1px_0_0_var(--border)]">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="align-top text-foreground">{row.label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
