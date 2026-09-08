import type { useTranslations } from "next-intl";

import { DAILY_HARD_LIMIT_MINUTES, DAILY_SOFT_WARNING_MINUTES } from "@/src/lib/time-entry-limits";
import type {
  TimeGridAssignedProject,
  TimeGridDay,
  TimeGridEntry,
} from "@/src/server/time-tracking";

/**
 * The pure half of `/time`: grouping, warnings and formatting rules the client, the grid lens and
 * the dialogs all share. No React, no server, no locale work beyond taking a translator.
 */

export type TimeTrackingTranslator = ReturnType<typeof useTranslations>;

export type CellEntries = {
  entries: TimeGridEntry[];
  totalMinutes: number;
  locked: boolean;
  needsDescription: boolean;
};

export function groupEntriesByCell(entries: TimeGridEntry[]) {
  const map = new Map<string, TimeGridEntry[]>();

  for (const entry of entries) {
    const key = cellKey(entry.projectId, entry.localDate);
    map.set(key, [...(map.get(key) ?? []), entry]);
  }

  return map;
}

export function groupEntriesByDay(entries: TimeGridEntry[]) {
  const map = new Map<string, TimeGridEntry[]>();

  for (const entry of entries) {
    map.set(entry.localDate, [...(map.get(entry.localDate) ?? []), entry]);
  }

  return map;
}

export function getDayLoggedMinutes(
  entries: TimeGridEntry[],
  localDate: string,
  excludingEntryId: string | null,
) {
  return entries.reduce((sum, entry) => {
    if (entry.localDate !== localDate || entry.id === excludingEntryId) return sum;
    return sum + entry.durationMinutes;
  }, 0);
}

export function getCellEntries(
  map: Map<string, TimeGridEntry[]>,
  projectId: string,
  localDate: string,
): CellEntries {
  const entries = map.get(cellKey(projectId, localDate)) ?? [];

  return {
    entries,
    totalMinutes: entries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
    locked: entries.some((entry) => entry.locked),
    needsDescription: entries.some((entry) => !entry.description.trim()),
  };
}

export function cellKey(projectId: string, localDate: string) {
  return `${projectId}:${localDate}`;
}

export function isSimpleDurationEntry(entry: TimeGridEntry | undefined): entry is TimeGridEntry {
  return Boolean(entry && !entry.startedAt && !entry.endedAt);
}

export function isProjectAssignableOnDate(project: TimeGridAssignedProject, localDate: string) {
  if (localDate < project.validFrom) return false;
  if (project.validTo && localDate > project.validTo) return false;
  if (project.projectStartsOn && localDate < project.projectStartsOn) return false;
  if (project.projectEndsOn && localDate > project.projectEndsOn) return false;
  return true;
}

/**
 * Days in the month a `YYYY-MM-01` names, from day 0 of the month after it.
 *
 * The client's half of `getMonthEnd`, over an ISO string. February, leap years and December all
 * fall out of the same arithmetic, and the server keeps its own copy because the warning shown here
 * and the bound recorded there must agree.
 */
export function countDaysInMonth(monthStartIso: string) {
  const year = Number.parseInt(monthStartIso.slice(0, 4), 10);
  const month = Number.parseInt(monthStartIso.slice(5, 7), 10);

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** A file size for the proof slot. Bytes are not a locale concept; the number is. */
export function formatBytesLabel(byteSize: number, locale: string) {
  const kilobytes = byteSize / 1024;

  return kilobytes >= 1024
    ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(kilobytes / 1024)} MB`
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(kilobytes)} kB`;
}

export function getCellWarnings(
  input: {
    day: TimeGridDay;
    dayTotalMinutes: number;
    entriesByDay: Map<string, TimeGridEntry[]>;
    cell: CellEntries;
  },
  t: TimeTrackingTranslator,
) {
  const warnings: string[] = [];

  if (input.cell.needsDescription) warnings.push(t("warnings.descriptionNeededSentence"));
  if (input.day.state === "future" && input.cell.totalMinutes > 0) {
    warnings.push(t("warnings.futureDay"));
  }
  if (input.dayTotalMinutes > DAILY_SOFT_WARNING_MINUTES) {
    warnings.push(t("warnings.dailyTotalOver8"));
  }
  if (hasOverlaps(input.entriesByDay.get(input.day.isoDate) ?? [])) {
    warnings.push(t("warnings.dayHasOverlaps"));
  }

  return warnings;
}

export function getEntryWarnings(
  entry: TimeGridEntry,
  dayEntries: TimeGridEntry[],
  t: TimeTrackingTranslator,
) {
  const warnings: string[] = [];

  if (!entry.description.trim()) warnings.push(t("warnings.descriptionNeeded"));
  if (entry.durationMinutes >= 480) warnings.push(t("warnings.longContinuousSession"));
  if (entryHasOverlap(entry, dayEntries)) warnings.push(t("warnings.overlapsAnotherEntry"));

  return warnings;
}

/** The admin's own timezone, not the reader's — the correction happened at a moment they know. */
export function formatAdminModifiedAt(
  modification: NonNullable<TimeGridEntry["adminModification"]>,
  locale: string,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: modification.timezone,
  }).format(new Date(modification.modifiedAt));
}

// A switch rather than a fall-through: `EntrySource` gained `DECLARED`, and a fall-through would
// have labelled a declared month "Grid" instead of failing. Adding a fifth value now widens the
// return type to `string | undefined` and breaks the call site.
export function formatEntrySource(source: TimeGridEntry["source"], t: TimeTrackingTranslator) {
  switch (source) {
    case "FORM":
      return t("source.form");
    case "TIMER":
      return t("source.timer");
    case "DECLARED":
      return t("source.declared");
    case "MCP":
      return t("source.mcp");
    case "GRID":
      return t("source.grid");
  }
}

export function hasOverlaps(entries: TimeGridEntry[]) {
  return entries.some((entry) => entryHasOverlap(entry, entries));
}

export function entryHasOverlap(entry: TimeGridEntry, entries: TimeGridEntry[]) {
  if (!entry.startedAt || !entry.endedAt) return false;
  const start = Date.parse(entry.startedAt);
  const end = Date.parse(entry.endedAt);

  if (Number.isNaN(start) || Number.isNaN(end)) return false;

  return entries.some((other) => {
    if (other.id === entry.id || !other.startedAt || !other.endedAt) return false;
    const otherStart = Date.parse(other.startedAt);
    const otherEnd = Date.parse(other.endedAt);
    if (Number.isNaN(otherStart) || Number.isNaN(otherEnd)) return false;
    return start < otherEnd && otherStart < end;
  });
}

export function calculateIntervalMinutes(startTime: string, endTime: string) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);

  if (start === null || end === null) return 0;

  const minutes = end > start ? end - start : end + DAILY_HARD_LIMIT_MINUTES - start;
  return minutes > 0 ? minutes : 0;
}

export function parseTimeToMinutes(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;

  const [hourValue, minuteValue] = value.split(":");
  const hour = Number.parseInt(hourValue ?? "", 10);
  const minute = Number.parseInt(minuteValue ?? "", 10);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

export function formatDraftTimestamp(value: string) {
  return value.replace("T", " ").slice(0, 16);
}
