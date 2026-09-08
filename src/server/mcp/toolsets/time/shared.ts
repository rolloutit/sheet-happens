import { formatDurationForInput } from "@/src/lib/duration";
import { DAILY_SOFT_WARNING_MINUTES } from "@/src/lib/time-entry-limits";
import {
  getMemberTimeEntry,
  listMemberTimeEntries,
  parseDateOnly,
  type MemberTimeEntryRow,
  type RunningTimerView,
} from "@/src/server/time-tracking";

import type { McpActor } from "../../actor";
import { MCP_LIMITS } from "../../config";

/**
 * The formatting and echo helpers every tool in this toolset shares.
 *
 * Two things live here rather than in each tool. First, duration formatting: a figure quoted back to
 * a member has to match the app, so it goes through the same `formatDurationForInput` the grid uses,
 * in the member's own display format. Second, the mutation echo: after any write the agent needs the
 * row it just changed *and* the day it landed in, and both come from the read path rather than from
 * the write's return value — the domain mutations return only `{ id }`, and re-reading is what keeps
 * a tool result and `/time` from ever disagreeing.
 */

export function durationText(minutes: number, actor: McpActor) {
  return formatDurationForInput(minutes, actor.member.durationDisplayFormat);
}

export type McpEntryView = {
  id: string;
  date: string;
  projectId: string;
  projectName: string;
  durationMinutes: number;
  durationText: string;
  startTime: string | null;
  endTime: string | null;
  description: string;
  source: MemberTimeEntryRow["source"];
  locked: boolean;
  updatedAt: string;
};

export function toEntryView(row: MemberTimeEntryRow, actor: McpActor): McpEntryView {
  return {
    id: row.id,
    date: row.date,
    projectId: row.projectId,
    projectName: row.projectName,
    durationMinutes: row.durationMinutes,
    durationText: durationText(row.durationMinutes, actor),
    startTime: row.startTime,
    endTime: row.endTime,
    description: row.description,
    source: row.source,
    /*
     * A declared month's entry is reported `locked` whatever the timesheet says. It is corrected on
     * the month level through the web app, and no tool here can change it — so from MCP's point of
     * view it is not editable, and saying otherwise would invite an agent to try.
     */
    locked: row.locked || row.source === "DECLARED",
    updatedAt: row.updatedAt,
  };
}

export type McpDayTotal = {
  date: string;
  totalMinutes: number;
  totalText: string;
  overSoftLimit: boolean;
};

export function toDayTotal(date: string, totalMinutes: number, actor: McpActor): McpDayTotal {
  return {
    date,
    totalMinutes,
    totalText: durationText(totalMinutes, actor),
    overSoftLimit: totalMinutes > DAILY_SOFT_WARNING_MINUTES,
  };
}

/**
 * The whole of one day, for the mutation echo.
 *
 * A single page is enough: 200 entries on one calendar day is far past what the 24-hour cap allows
 * anything meaningful to be, so `totals.minutes` here is the day's real total rather than a page of
 * it. The limit is pinned to the maximum on purpose — a smaller page would quietly under-report.
 */
export async function readDay(actor: McpActor, date: string) {
  const day = parseDateOnly(date);

  const page = await listMemberTimeEntries({
    memberId: actor.member.id,
    from: day,
    to: day,
    limit: MCP_LIMITS.listPageSizeMax,
  });

  return {
    date,
    entries: page.entries,
    totalMinutes: page.totals.minutes,
    entryCount: page.totals.entryCount,
  };
}

/**
 * The echo after a create or update: the row as it now stands, plus its day.
 *
 * Reads the entry by id rather than searching the day's page for it, because an update may have
 * moved it to a different date than the one the caller asked about.
 */
export async function readMutationResult(
  actor: McpActor,
  input: { entryId: string; includeDeleted?: boolean },
) {
  const row = await getMemberTimeEntry({
    memberId: actor.member.id,
    timeEntryId: input.entryId,
    ...(input.includeDeleted ? { includeDeleted: true } : {}),
  });

  if (!row) {
    return null;
  }

  const day = await readDay(actor, row.date);
  const entry = toEntryView(row, actor);
  const dayTotal = toDayTotal(row.date, day.totalMinutes, actor);

  return {
    entry,
    day: dayTotal,
    warnings: dayWarnings(dayTotal, entry),
  };
}

/**
 * The soft signals `/time` draws and the server never blocks on.
 *
 * An agent has no pixels, so the nudge a member would have seen as a colour travels as a sentence.
 * These are never errors: nine hours on a Tuesday is a fact about the week, not a rule violation.
 */
export function dayWarnings(day: McpDayTotal, entry?: McpEntryView): string[] {
  const warnings: string[] = [];

  if (day.overSoftLimit) {
    warnings.push(
      `${day.date} now totals ${day.totalText} (over the ${durationTextForSoftLimit()} soft target).`,
    );
  }

  if (entry && entry.durationMinutes >= DAILY_SOFT_WARNING_MINUTES) {
    warnings.push(
      `This single entry is ${entry.durationText} long — check it is not two sessions in one.`,
    );
  }

  return warnings;
}

function durationTextForSoftLimit() {
  return `${DAILY_SOFT_WARNING_MINUTES / 60}-hour`;
}

/** One entry as a single line of text, for the text channel. Data only, never an instruction. */
export function entryLine(entry: McpEntryView) {
  const clock = entry.startTime && entry.endTime ? ` ${entry.startTime}-${entry.endTime}` : "";
  const locked = entry.locked ? " [locked]" : "";

  return `${entry.date}${clock}  ${entry.durationText}  ${entry.projectName}  ${entry.description}${locked}  (${entry.id})`;
}

export function timerLine(timer: RunningTimerView | null, elapsedMinutes: number, actor: McpActor) {
  if (!timer) return "No timer is running.";

  return `Running on ${timer.projectName} since ${timer.startedAt} — ${durationText(elapsedMinutes, actor)} so far.`;
}

/**
 * Minutes a running timer has accumulated.
 *
 * Rounded UP with a floor of one, matching `stopRunningTimer` exactly. Reporting a different figure
 * from the one a stop would actually save is worse than reporting none.
 */
export function elapsedMinutesFor(startedAt: string, now: Date = new Date()) {
  return Math.max(1, Math.ceil((now.getTime() - new Date(startedAt).getTime()) / 60_000));
}

/** `to - from` in whole days, inclusive of both ends. */
export function inclusiveDaySpan(from: string, to: string) {
  const start = parseDateOnly(from).getTime();
  const end = parseDateOnly(to).getTime();

  return Math.floor((end - start) / 86_400_000) + 1;
}
