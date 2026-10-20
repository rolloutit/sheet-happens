"use client";

import { Palmtree, Paperclip, Sunrise, Sunset } from "lucide-react";

import { EmptyState } from "@/src/components/sheet/EmptyState";
import { LeaveKindBadge } from "@/src/components/sheet/LeaveKindBadge";
import { cn } from "@/src/lib/utils";
import type { LeaveView } from "./leave-view-types";
import { useLeaveText } from "./use-leave-labels";

export type OwnLeaveListProps = {
  upcoming: LeaveView[];
  past: LeaveView[];
  onSelect: (leave: LeaveView) => void;
};

/** The employee's own leave, what is still ahead first, the rest below it newest first. */
export function OwnLeaveList({ upcoming, past, onSelect }: OwnLeaveListProps) {
  const { t } = useLeaveText();

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <EmptyState icon={Palmtree} title={t("list.emptyTitle")} body={t("list.emptyDescription")} />
    );
  }

  return (
    <div className="grid gap-8">
      <LeaveGroup
        title={t("list.upcoming")}
        leaves={upcoming}
        empty={t("list.noUpcoming")}
        onSelect={onSelect}
      />
      {past.length > 0 ? (
        <LeaveGroup title={t("list.past")} leaves={past} onSelect={onSelect} muted />
      ) : null}
    </div>
  );
}

function LeaveGroup({
  title,
  leaves,
  empty,
  muted = false,
  onSelect,
}: {
  title: string;
  leaves: LeaveView[];
  empty?: string;
  muted?: boolean;
  onSelect: (leave: LeaveView) => void;
}) {
  const text = useLeaveText();
  const { t } = text;
  const headingId = `leave-group-${title.replaceAll(/\s+/g, "-").toLowerCase()}`;

  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <h2 id={headingId} className="font-ui text-base font-semibold text-foreground">
        {title}
      </h2>
      {leaves.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-2">
          {leaves.map((leave) => {
            const needsNote = leave.kind === "sick" && !leave.attachment;
            return (
              <li key={leave.id}>
                <button
                  type="button"
                  onClick={() => onSelect(leave)}
                  className={cn(
                    "grid w-full gap-2 rounded-[var(--radius-lg)] border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
                    muted && "bg-card/60",
                  )}
                >
                  <span className="grid gap-1">
                    <span className="font-ui text-sm font-semibold text-foreground">
                      {text.range(leave)}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{text.workdays(leave.workdays)}</span>
                      {leave.dayPart !== "FULL" ? (
                        <span className="inline-flex items-center gap-1">
                          {leave.dayPart === "MORNING" ? (
                            <Sunrise className="size-3.5" aria-hidden="true" />
                          ) : (
                            <Sunset className="size-3.5" aria-hidden="true" />
                          )}
                          {text.dayPart(leave)}
                        </span>
                      ) : null}
                      {leave.note ? <span className="max-w-80 truncate">{leave.note}</span> : null}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {leave.kind === "sick" ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-medium",
                          needsNote ? "text-warning" : "text-muted-foreground",
                        )}
                      >
                        <Paperclip className="size-3.5" aria-hidden="true" />
                        {needsNote ? t("list.noteMissing") : t("list.noteAttached")}
                      </span>
                    ) : null}
                    <LeaveKindBadge kind={leave.kind} label={text.kind(leave)} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
