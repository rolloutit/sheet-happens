import { z } from "zod";

import { listMemberTimeEntries, parseDateOnly } from "@/src/server/time-tracking";

import { MCP_LIMITS } from "../../config";
import { fail, ok, runTool } from "../../results";
import { entryView, isoDate, projectId } from "../../schemas/common";
import { READ_ONLY_ANNOTATIONS, type McpTool } from "../../tool";
import { durationText, entryLine, inclusiveDaySpan, toEntryView } from "./shared";

const inputSchema = z
  .object({
    from: isoDate,
    to: isoDate,
    /*
     * The shared `projectId` piece with a filter's wording. Re-describing returns a copy rather
     * than mutating the shared schema, so the "ids, never names" rule stays defined in one place
     * while the sentence the model reads is about narrowing a list rather than about writing.
     */
    projectId: projectId
      .describe("Optional. Only entries logged against this project id, from time_get_context.")
      .optional(),
    includeDeclared: z
      .boolean()
      .default(false)
      .describe(
        "Include the entries of a month that declares its hours in bulk. False by default: a declaration is one month-sized entry, so adding it to tracked entries counts that month twice.",
      ),
    cursor: z
      .string()
      .min(1)
      .describe("The nextCursor of the previous page. Opaque — pass it back unchanged.")
      .optional(),
    /*
     * No `.min`/`.max` on purpose. The bound is enforced by clamping in the handler, because a
     * refused call teaches the model nothing it can act on — it retries with another guess — while
     * a clamp answers the question it actually asked. The domain layer clamps identically, so the
     * two cannot disagree; doing it here as well is what makes the returned `limit` predictable
     * from this file alone.
     */
    limit: z
      .number()
      .int()
      .default(MCP_LIMITS.listPageSize)
      .describe(
        `Entries per page, 1-${MCP_LIMITS.listPageSizeMax}. A value outside that range is clamped, not refused.`,
      ),
  })
  .strict();

const outputSchema = z
  .object({
    range: z.object({ from: isoDate, to: isoDate }).strict(),
    entries: z.array(entryView),
    /**
     * The totals of the RETURNED PAGE. Named `minutes` rather than `totalMinutes` to match the
     * domain result it comes from, and paired with `minutesText` so the agent can quote the figure
     * in the member's own display format instead of re-deriving it and rounding differently.
     */
    totals: z
      .object({
        minutes: z.number().int(),
        minutesText: z.string(),
        entryCount: z.number().int(),
      })
      .strict(),
    nextCursor: z.string().nullable(),
  })
  .strict();

const DESCRIPTION = `List the signed-in member's own time entries in a date range, oldest first.

\`from\` and \`to\` are \`YYYY-MM-DD\` in the member's timezone and both ends are included; call \`time_get_context\` for today's date in that timezone. A range may span at most ${MCP_LIMITS.listRangeDays} days — a wider one is refused with \`RANGE_TOO_LARGE\` rather than truncated. \`projectId\` narrows the list to one project.

Results are paged: \`limit\` defaults to ${MCP_LIMITS.listPageSize} and is capped at ${MCP_LIMITS.listPageSizeMax}. \`totals\` describes the page that came back, NOT the whole range, so the range's total is known only once every page has been read — pass \`nextCursor\` back as \`cursor\` with the same \`from\`/\`to\` until it comes back \`null\`. When a range is too large, page through it; do not widen it to save a call.

Deleted entries are never returned. Entries of a month whose hours are declared in bulk are excluded unless \`includeDeclared\` is true.`;

export const listEntriesTool: McpTool = {
  name: "time_list_entries",
  scope: "time:read",
  register(server, actor) {
    server.registerTool(
      "time_list_entries",
      {
        title: "List time entries",
        description: DESCRIPTION,
        inputSchema,
        outputSchema,
        annotations: READ_ONLY_ANNOTATIONS,
      },
      async (args) =>
        runTool("time_list_entries", async () => {
          // `YYYY-MM-DD` sorts lexicographically exactly as it does chronologically, and the regex
          // on `isoDate` guarantees the shape, so this needs no parse — and therefore reports a
          // swapped range as the argument mistake it is rather than as an empty result.
          if (args.to < args.from) {
            return fail(
              "VALIDATION",
              "`to` is earlier than `from`. Give the range in chronological order.",
              { from: args.from, to: args.to },
            );
          }

          const requestedDays = inclusiveDaySpan(args.from, args.to);

          if (requestedDays > MCP_LIMITS.listRangeDays) {
            // Checked before the query, so an over-wide range costs no database work — and the
            // model is told the remedy, because the alternative it reaches for on its own is a
            // second, equally over-wide call.
            return fail(
              "RANGE_TOO_LARGE",
              `A range may span at most ${MCP_LIMITS.listRangeDays} days and this one spans ${requestedDays}. Ask for a narrower range and read it page by page with \`cursor\` instead of widening the range.`,
              { requestedDays, maxDays: MCP_LIMITS.listRangeDays },
            );
          }

          const page = await listMemberTimeEntries({
            memberId: actor.member.id,
            from: parseDateOnly(args.from),
            to: parseDateOnly(args.to),
            ...(args.projectId === undefined ? {} : { projectId: args.projectId }),
            includeDeclared: args.includeDeclared,
            ...(args.cursor === undefined ? {} : { cursor: args.cursor }),
            limit: Math.min(MCP_LIMITS.listPageSizeMax, Math.max(1, args.limit)),
          });

          const structured = {
            range: page.range,
            entries: page.entries.map((row) => toEntryView(row, actor)),
            totals: {
              minutes: page.totals.minutes,
              minutesText: durationText(page.totals.minutes, actor),
              entryCount: page.totals.entryCount,
            },
            nextCursor: page.nextCursor,
          };

          const { entryCount, minutesText } = structured.totals;

          const lines = [
            ...(structured.entries.length
              ? structured.entries.map(entryLine)
              : [`No entries between ${structured.range.from} and ${structured.range.to}.`]),
            `Page total: ${entryCount} ${entryCount === 1 ? "entry" : "entries"}, ${minutesText}. That is this page only, not the range — the range total is the sum of every page, each counted once.`,
          ];

          if (structured.nextCursor) {
            lines.push(
              `More entries follow this page. Read the next one with the same from/to and cursor=${structured.nextCursor}.`,
            );
          }

          return ok(structured, lines);
        }),
    );
  },
};
