"use client";

import { Sunrise, Sunset, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/Popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/Tooltip";
import { formatWeekdayLabel } from "@/src/lib/formatting";
import { cn } from "@/src/lib/utils";

import { leaveKindIcons, LeaveKindBadge } from "../LeaveKindBadge";
import { BUSY_DAY_THRESHOLD, buildLeaveAgenda, buildLeaveWeeks } from "./LeaveCalendar.model";
import type {
  LeaveCalendarDay,
  LeaveCalendarKind,
  LeaveCalendarLabels,
  LeaveCalendarLeave,
  LeaveCalendarProps,
  LeaveCalendarWeek,
  LeaveSegment,
} from "./LeaveCalendar.types";
import { leaveDayVariants, leaveRibbonVariants } from "./LeaveCalendar.variants";

/**
 * A month of who is away, as continuous ribbons over a Monday-first grid.
 *
 * The calendar draws what it is given: which leaves are a colleague's `absent` and which carry a
 * kind is the server's decision. Below `md` the grid gives way to an agenda of the days that hold
 * something, because seven columns of ribbons do not survive a phone's width.
 */
export function LeaveCalendar({
  monthStart,
  todayIso,
  leaves,
  holidays,
  locale,
  labels,
  onSelectLeave,
  className,
}: LeaveCalendarProps) {
  const weeks = useMemo(
    () => buildLeaveWeeks({ monthStart, todayIso, leaves, holidays }),
    [monthStart, todayIso, leaves, holidays],
  );
  const agenda = useMemo(() => buildLeaveAgenda(weeks), [weeks]);
  const weekdays = weeks[0]?.days.map((day) => ({
    short: formatWeekdayLabel(day.isoDate, locale, { style: "short" }),
    weekend: day.weekend,
  }));
  const kinds = [...new Set(leaves.map((leave) => leave.kind))].sort(
    (a, b) => kindOrder.indexOf(a) - kindOrder.indexOf(b),
  );

  return (
    <section
      aria-label={labels.calendar}
      className={cn(
        "overflow-hidden rounded-[var(--radius-xl)] border border-border bg-card",
        className,
      )}
    >
      <div className="hidden md:block">
        <div
          aria-hidden="true"
          className="grid grid-cols-7 border-b border-border bg-secondary/60 font-ui text-xs font-medium text-muted-foreground"
        >
          {weekdays?.map((weekday, index) => (
            <span
              key={index}
              className={cn("px-2.5 py-2", weekday.weekend && "text-subtle-foreground")}
            >
              {weekday.short}
            </span>
          ))}
        </div>
        <TooltipProvider delayDuration={200}>
          <ol className="divide-y divide-border">
            {weeks.map((week) => (
              <WeekRow key={week.weekStart} week={week} labels={labels} onSelect={onSelectLeave} />
            ))}
          </ol>
        </TooltipProvider>
      </div>

      <Agenda agenda={agenda} labels={labels} onSelect={onSelectLeave} />

      <Legend kinds={kinds} labels={labels} hasHoliday={holidays.length > 0} />
    </section>
  );
}

const kindOrder: LeaveCalendarKind[] = ["vacation", "sick", "absent"];

/** A lone absence is already its ribbon; the headcount starts where counting ribbons gets tedious. */
const SHOW_AWAY_COUNT_FROM = 2;

function WeekRow({
  week,
  labels,
  onSelect,
}: {
  week: LeaveCalendarWeek;
  labels: LeaveCalendarLabels;
  onSelect?: (leave: LeaveCalendarLeave) => void;
}) {
  const overflowing = week.visibleLaneCount < week.laneCount;

  return (
    <li aria-label={labels.week(week.weekNumber)}>
      <div
        className="relative grid min-h-28 grid-cols-7"
        style={{
          // A fixed header row for the day numbers: every day cell spans all rows, so an `auto` row
          // would collapse to nothing and the ribbons would ride over the numbers. The last row
          // keeps room under the ribbons for a holiday's name; a crowded week adds one row for its
          // "+N more" buttons instead of growing a lane per person.
          gridTemplateRows: `2.25rem repeat(${week.visibleLaneCount + (overflowing ? 1 : 0)}, 1.75rem) minmax(${
            week.days.some((day) => day.holiday) ? "2.5rem" : "0.75rem"
          }, 1fr)`,
        }}
      >
        {week.days.map((day, index) => (
          <div
            key={day.isoDate}
            className={cn(
              leaveDayVariants({
                tone: day.holiday ? "holiday" : day.weekend ? "weekend" : "workday",
                inMonth: day.inMonth,
              }),
              "flex min-w-0 flex-col justify-between gap-0.5 px-2 pt-1.5 pb-1.5",
              index > 0 && "border-l",
            )}
            style={{ gridColumn: index + 1, gridRow: "1 / -1" }}
          >
            <span className="flex items-center gap-1.5">
              <span className="sr-only">{labels.day(day.isoDate)}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-6 place-items-center rounded-full font-ui text-sm tabular-nums",
                  day.today
                    ? "bg-accent font-semibold text-accent-foreground"
                    : day.holiday
                      ? "font-semibold text-destructive-bright"
                      : day.weekend || !day.inMonth
                        ? "text-muted-foreground"
                        : "text-foreground",
                )}
              >
                {day.dayNumber}
              </span>
              {day.today ? <span className="sr-only">{labels.today}</span> : null}
              {day.awayCount >= SHOW_AWAY_COUNT_FROM ? (
                <AwayCount count={day.awayCount} labels={labels} />
              ) : null}
            </span>
            {day.holiday ? (
              <span className="line-clamp-2 text-[0.68rem] leading-tight font-medium text-destructive-bright">
                <span className="sr-only">{labels.holiday}: </span>
                {day.holiday}
              </span>
            ) : null}
          </div>
        ))}

        {week.segments
          .filter((segment) => !segment.hidden)
          .map((segment) => (
            <Ribbon
              key={`${segment.leave.id}-${week.weekStart}`}
              segment={segment}
              labels={labels}
              onSelect={onSelect}
            />
          ))}

        {overflowing
          ? week.days.map((day, index) =>
              day.hidden.length > 0 ? (
                <DayOverflow
                  key={`more-${day.isoDate}`}
                  day={day}
                  column={index + 1}
                  row={week.visibleLaneCount + 2}
                  labels={labels}
                  onSelect={onSelect}
                />
              ) : null,
            )
          : null}
      </div>
    </li>
  );
}

/** The day's headcount; from `BUSY_DAY_THRESHOLD` people it turns amber so a thin day stands out. */
function AwayCount({ count, labels }: { count: number; labels: LeaveCalendarLabels }) {
  const busy = count >= BUSY_DAY_THRESHOLD;
  return (
    <span
      className={cn(
        "ml-auto inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-1.5 py-0.5 font-ui text-[0.68rem] leading-none font-semibold tabular-nums",
        busy
          ? "border-warning/45 bg-warning-soft text-warning"
          : "border-border bg-secondary text-muted-foreground",
      )}
    >
      <Users aria-hidden="true" className="size-3" />
      {labels.away(count)}
    </span>
  );
}

/**
 * What a crowded week does not draw. Hovering or focusing names who is behind the button; clicking
 * opens the whole day, drawn and hidden alike, each one selectable.
 */
function DayOverflow({
  day,
  column,
  row,
  labels,
  onSelect,
}: {
  day: LeaveCalendarDay;
  column: number;
  row: number;
  labels: LeaveCalendarLabels;
  onSelect?: (leave: LeaveCalendarLeave) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative z-10 mx-1 flex h-6 items-center justify-center self-center rounded-full border border-dashed border-border-strong bg-card font-ui text-[0.72rem] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              style={{ gridColumn: column, gridRow: row }}
            >
              {labels.more(day.hidden.length)}
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56">
          <ul className="grid gap-0.5 text-xs">
            {day.hidden.map((leave) => (
              <li key={leave.id}>{labels.ribbon(leave)}</li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-64 p-3">
        <p className="mb-2 font-ui text-sm font-semibold text-foreground">
          {labels.awayOn(day.isoDate)}
        </p>
        <ul className="grid gap-1.5">
          {day.leaves.map((leave) => (
            <li key={leave.id}>
              <button
                type="button"
                aria-label={labels.leave(leave)}
                onClick={() => {
                  setOpen(false);
                  onSelect?.(leave);
                }}
                className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <LeaveKindBadge kind={leave.kind} label={halfDayLabel(leave, labels)} />
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function halfDayLabel(leave: LeaveCalendarLeave, labels: LeaveCalendarLabels) {
  const part =
    leave.dayPart === "MORNING"
      ? `, ${labels.morning}`
      : leave.dayPart === "AFTERNOON"
        ? `, ${labels.afternoon}`
        : "";
  return `${labels.ribbon(leave)}${part}`;
}

function Ribbon({
  segment,
  labels,
  onSelect,
}: {
  segment: LeaveSegment;
  labels: LeaveCalendarLabels;
  onSelect?: (leave: LeaveCalendarLeave) => void;
}) {
  const { leave } = segment;
  const KindIcon = leaveKindIcons[leave.kind];
  const HalfIcon =
    leave.dayPart === "MORNING" ? Sunrise : leave.dayPart === "AFTERNOON" ? Sunset : null;
  const name = labels.leave(leave);

  return (
    <button
      type="button"
      aria-label={name}
      title={name}
      onClick={() => onSelect?.(leave)}
      className={leaveRibbonVariants({
        kind: leave.kind,
        own: leave.isOwn,
        start: segment.continuesBefore ? "cut" : "round",
        end: segment.continuesAfter ? "cut" : "round",
        dayPart: leave.dayPart,
      })}
      style={{
        gridColumn: `${segment.startColumn + 1} / span ${segment.span}`,
        gridRow: segment.lane + 2,
      }}
    >
      {HalfIcon ? <HalfIcon aria-hidden="true" /> : <KindIcon aria-hidden="true" />}
      <span className="truncate">{labels.ribbon(leave)}</span>
    </button>
  );
}

function Agenda({
  agenda,
  labels,
  onSelect,
}: {
  agenda: ReturnType<typeof buildLeaveAgenda>;
  labels: LeaveCalendarLabels;
  onSelect?: (leave: LeaveCalendarLeave) => void;
}) {
  if (agenda.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground md:hidden">
        {labels.empty}
      </p>
    );
  }

  return (
    <ol className="divide-y divide-border md:hidden">
      {agenda.map(({ day, leaves }) => (
        <li key={day.isoDate} className="grid gap-2 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span
              className={cn(
                "font-ui text-sm font-semibold",
                day.holiday ? "text-destructive-bright" : "text-foreground",
              )}
            >
              {labels.day(day.isoDate)}
              {day.today ? (
                <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                  {labels.today}
                </span>
              ) : null}
            </span>
            {day.holiday ? (
              <span className="text-xs font-medium text-destructive-bright">
                <span className="sr-only">{labels.holiday}: </span>
                {day.holiday}
              </span>
            ) : day.awayCount >= SHOW_AWAY_COUNT_FROM ? (
              <AwayCount count={day.awayCount} labels={labels} />
            ) : null}
          </div>
          {leaves.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {leaves.map((leave) => (
                <li key={leave.id}>
                  <button
                    type="button"
                    aria-label={labels.leave(leave)}
                    onClick={() => onSelect?.(leave)}
                    className="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <LeaveKindBadge kind={leave.kind} label={halfDayLabel(leave, labels)} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function Legend({
  kinds,
  labels,
  hasHoliday,
}: {
  kinds: LeaveCalendarKind[];
  labels: LeaveCalendarLabels;
  hasHoliday: boolean;
}) {
  if (kinds.length === 0 && !hasHoliday) return null;

  return (
    <ul className="flex flex-wrap items-center gap-2 border-t border-border bg-secondary/40 px-4 py-3">
      {kinds.map((kind) => (
        <li key={kind}>
          <LeaveKindBadge kind={kind} label={labels.kinds[kind]} size="sm" />
        </li>
      ))}
      {hasHoliday ? (
        <li className="inline-flex items-center gap-1.5 px-1 font-ui text-xs font-semibold text-destructive-bright">
          <span aria-hidden="true" className="size-2 rounded-full bg-destructive" />
          {labels.holiday}
        </li>
      ) : null}
      <li className="ml-auto hidden items-center gap-3 text-xs text-muted-foreground sm:inline-flex">
        <span className="inline-flex items-center gap-1">
          <Sunrise aria-hidden="true" className="size-3.5" />
          {labels.morning}
        </span>
        <span className="inline-flex items-center gap-1">
          <Sunset aria-hidden="true" className="size-3.5" />
          {labels.afternoon}
        </span>
      </li>
    </ul>
  );
}
