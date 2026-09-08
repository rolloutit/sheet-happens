import { z } from "zod";

import {
  getMemberTrackingContext,
  getMonday,
  getMonthEnd,
  getMonthStart,
  getWeekEnd,
  parseDateOnly,
  summarizeMemberTime,
} from "@/src/server/time-tracking";

import { MCP_LIMITS } from "../../config";
import { fail, ok, runTool } from "../../results";
import { isoDate } from "../../schemas/common";
import { READ_ONLY_ANNOTATIONS, type McpTool } from "../../tool";
import { durationText, inclusiveDaySpan } from "./shared";

const periodKind = z.enum(["day", "week", "month", "range"]);

/**
 * A named period plus an anchor, rather than a from/to pair for everything.
 *
 * "How did last week go?" is the question actually asked, and a model that works the window out
 * itself gets it wrong in ways nobody can see afterwards — an ISO week starting on Sunday, a month
 * ending on the 30th of February, a "last 7 days" that quietly includes today twice. Naming the
 * period moves that arithmetic to the same helpers `/time` uses, so the figures an agent quotes and
 * the figures on the page come from one derivation. `range` stays for the genuinely arbitrary
 * window, and is the only shape that needs two dates.
 */
const inputSchema = z
  .object({
    period: periodKind
      .default("week")
      .describe(
        "day, week (Monday to Sunday), or month — each derived from `date`. Use range only for an arbitrary window, which requires from and to.",
      ),
    date: isoDate
      .optional()
      .describe(
        "Anchor day for day, week and month. Defaults to today in the member's timezone. Ignored when period is range.",
      ),
    from: isoDate.optional().describe("First day of a range period, inclusive."),
    to: isoDate.optional().describe("Last day of a range period, inclusive."),
    compareWithPrevious: z
      .boolean()
      .default(true)
      .describe(
        "Also total the window of the same length immediately before this one, as `previous`.",
      ),
  })
  .strict();

const outputSchema = z
  .object({
    period: z
      .object({
        kind: periodKind,
        start: isoDate,
        end: isoDate,
        /** True only when EVERY month the window touches is locked — a half-open range is not. */
        locked: z.boolean(),
      })
      .strict(),
    totals: z
      .object({
        trackedMinutes: z.number().int(),
        trackedText: z.string(),
        declaredMinutes: z.number().int(),
        declaredText: z.string(),
        totalMinutes: z.number().int(),
        totalText: z.string(),
        entryCount: z.number().int(),
        daysWithEntries: z.number().int(),
        averageMinutesPerActiveDay: z.number().int(),
      })
      .strict(),
    byProject: z.array(
      z
        .object({
          projectId: z.string(),
          name: z.string(),
          minutes: z.number().int(),
          minutesText: z.string(),
          entryCount: z.number().int(),
          share: z.number(),
        })
        .strict(),
    ),
    byDay: z.array(
      z
        .object({
          date: isoDate,
          minutes: z.number().int(),
          minutesText: z.string(),
          entryCount: z.number().int(),
          overSoftLimit: z.boolean(),
        })
        .strict(),
    ),
    previous: z
      .object({
        start: isoDate,
        end: isoDate,
        totalMinutes: z.number().int(),
        totalText: z.string(),
        deltaMinutes: z.number().int(),
        deltaText: z.string(),
      })
      .strict()
      .nullable(),
    notes: z.array(z.string()),
  })
  .strict();

/**
 * The sentence that has to travel with every summary.
 *
 * Declared hours are a whole-month figure attested for another company's system; tracked hours are
 * entries logged here. `totalMinutes` is what the member is responsible for across both, and the two
 * are never added into `trackedMinutes`. Without this note an agent looking at a month with a
 * declaration will read the gap between the two totals as missing time and offer to fill it in.
 */
const DECLARED_SEPARATION_NOTE =
  "Declared hours are reported separately and never mixed into tracked totals.";

/** How many projects the text channel names. The structured channel always carries all of them. */
const TEXT_PROJECT_LIMIT = 3;

const DESCRIPTION = `Deterministic totals for the signed-in member over one period — use this instead of adding up \`time_list_entries\` yourself.

\`period\` is "day", "week" (Monday to Sunday), "month" or "range". The first three are derived from \`date\`, which defaults to today in the member's timezone; "range" needs both \`from\` and \`to\` and may span at most ${MCP_LIMITS.summaryRangeDays} days.

Returns the window's totals, a per-project and a per-day breakdown, and — unless \`compareWithPrevious\` is false — the same-length window immediately before it. \`deltaMinutes\` is signed, so a negative value is a drop; \`deltaText\` is that change's size without the sign.

Declared hours appear as \`declaredMinutes\` and are never part of \`trackedMinutes\`; only months lying entirely inside the window contribute any. A day over 8 hours is flagged in \`byDay\`, which is a fact about the week and not a rule violation.`;

export const summaryTool: McpTool = {
  name: "time_summary",
  scope: "time:read",
  register(server, actor) {
    server.registerTool(
      "time_summary",
      {
        title: "Summarize tracked time",
        description: DESCRIPTION,
        inputSchema,
        outputSchema,
        annotations: READ_ONLY_ANNOTATIONS,
      },
      async (args) =>
        runTool("time_summary", async () => {
          let from: Date;
          let to: Date;

          if (args.period === "range") {
            if (!args.from || !args.to) {
              return fail(
                "VALIDATION",
                'A "range" period needs both from and to as YYYY-MM-DD. For a calendar day, week or month use that period instead and let the server derive the window.',
                { period: args.period, from: args.from ?? null, to: args.to ?? null },
              );
            }

            const days = inclusiveDaySpan(args.from, args.to);

            if (days < 1) {
              // A backwards range matches no rows, so without this it would come back as a
              // perfectly well-formed summary of zero hours — and get narrated as a week off.
              return fail("VALIDATION", "from must be on or before to.", {
                from: args.from,
                to: args.to,
              });
            }

            if (days > MCP_LIMITS.summaryRangeDays) {
              return fail(
                "RANGE_TOO_LARGE",
                `A range may span at most ${MCP_LIMITS.summaryRangeDays} days; that one spans ${days}. Ask for narrower windows and add them up.`,
                { requestedDays: days, maxDays: MCP_LIMITS.summaryRangeDays },
              );
            }

            from = parseDateOnly(args.from);
            to = parseDateOnly(args.to);
          } else {
            /*
             * Today comes from the member's own context, never from `new Date()`. The server runs in
             * UTC and the member does not: at half past one in the morning in Budapest the process
             * is still on yesterday, which on a Monday is a different week — and an agent asking for
             * "this week" would be handed the last one. The read is skipped when `date` is given,
             * and for `range`, which needs no anchor.
             */
            const anchor = parseDateOnly(
              args.date ?? (await getMemberTrackingContext({ memberId: actor.member.id })).today,
            );
            const window = windowFor(args.period, anchor);

            from = window.from;
            to = window.to;
          }

          const summary = await summarizeMemberTime({
            memberId: actor.member.id,
            from,
            to,
            compareWithPrevious: args.compareWithPrevious,
          });

          const trackedText = durationText(summary.totals.trackedMinutes, actor);
          const declaredText = durationText(summary.totals.declaredMinutes, actor);
          const totalText = durationText(summary.totals.totalMinutes, actor);

          const notes = [DECLARED_SEPARATION_NOTE];

          if (summary.totals.declaredMinutes > 0) {
            notes.push(
              `This period includes ${declaredText} of declared hours on top of ${trackedText} tracked, counted in totalMinutes only.`,
            );
          }

          const previous = summary.previous
            ? {
                start: summary.previous.start,
                end: summary.previous.end,
                totalMinutes: summary.previous.totalMinutes,
                totalText: durationText(summary.previous.totalMinutes, actor),
                deltaMinutes: summary.previous.deltaMinutes,
                /*
                 * The size of the change, with the direction left on `deltaMinutes`.
                 * `formatDurationForInput` clamps a negative to zero, so formatting the signed
                 * value would render a four-hour drop as "0" — a fall reported as no change at all,
                 * in the member's own display format, with nothing to give it away.
                 */
                deltaText: durationText(Math.abs(summary.previous.deltaMinutes), actor),
              }
            : null;

          const structured = {
            period: {
              kind: args.period,
              start: summary.period.start,
              end: summary.period.end,
              locked: summary.period.locked,
            },
            totals: {
              trackedMinutes: summary.totals.trackedMinutes,
              trackedText,
              declaredMinutes: summary.totals.declaredMinutes,
              declaredText,
              totalMinutes: summary.totals.totalMinutes,
              totalText,
              entryCount: summary.totals.entryCount,
              daysWithEntries: summary.totals.daysWithEntries,
              averageMinutesPerActiveDay: summary.totals.averageMinutesPerActiveDay,
            },
            byProject: summary.byProject.map((project) => ({
              projectId: project.projectId,
              name: project.name,
              minutes: project.minutes,
              minutesText: durationText(project.minutes, actor),
              entryCount: project.entryCount,
              share: project.share,
            })),
            byDay: summary.byDay.map((day) => ({
              date: day.date,
              minutes: day.minutes,
              minutesText: durationText(day.minutes, actor),
              entryCount: day.entryCount,
              overSoftLimit: day.overSoftLimit,
            })),
            previous,
            notes,
          };

          const lines = [
            `${args.period} ${summary.period.start}..${summary.period.end}${summary.period.locked ? " [locked]" : ""}: ${totalText} total (${trackedText} tracked, ${declaredText} declared) from ${summary.totals.entryCount} entries on ${summary.totals.daysWithEntries} days.`,
            summary.byProject.length
              ? `Top projects: ${summary.byProject
                  .slice(0, TEXT_PROJECT_LIMIT)
                  .map(
                    (project) =>
                      `${project.name} ${durationText(project.minutes, actor)} (${Math.round(project.share * 100)}%)`,
                  )
                  .join("; ")}`
              : "No tracked time in this period.",
            ...(previous
              ? [
                  `Previous ${previous.start}..${previous.end}: ${previous.totalText} total — ${deltaPhrase(previous.deltaMinutes, previous.deltaText)}.`,
                ]
              : []),
            ...notes,
          ];

          return ok(structured, lines);
        }),
    );
  },
};

/**
 * The window a named period covers, from the same helpers the grid and the month view use.
 *
 * Weeks are Monday-based because that is what this app means by a week everywhere else; the month
 * end is derived from the following month's day zero, so February and leap years need no special
 * case. `day` returns the anchor on both ends — `summarizeMemberTime` treats the bounds inclusively.
 */
function windowFor(period: "day" | "week" | "month", anchor: Date) {
  if (period === "day") {
    return { from: anchor, to: anchor };
  }

  if (period === "week") {
    const weekStart = getMonday(anchor);

    return { from: weekStart, to: getWeekEnd(weekStart) };
  }

  return { from: getMonthStart(anchor), to: getMonthEnd(anchor) };
}

/** Direction for the text channel only; `deltaMinutes` carries it for anything that computes. */
function deltaPhrase(deltaMinutes: number, deltaText: string) {
  if (deltaMinutes === 0) return "unchanged";

  return deltaMinutes > 0 ? `up ${deltaText}` : `down ${deltaText}`;
}
