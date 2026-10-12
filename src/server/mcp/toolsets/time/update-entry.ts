import { z } from "zod";

import { parseDateOnly, updateTimeEntry } from "@/src/server/time-tracking";

import { fail, ok, runTool } from "../../results";
import {
  description,
  durationMinutes,
  entryId,
  isoDate,
  localTime,
  mutationResult,
  projectId,
} from "../../schemas/common";
import { UPDATE_ANNOTATIONS, type McpTool } from "../../tool";
import { entryLine, readMutationResult } from "./shared";

/**
 * A patch with at least one field, and never both timing forms at once.
 *
 * `superRefine` rather than a set of named variants: an update genuinely is a patch — any subset of
 * the fields — and enumerating the subsets would both explode the advertised schema and force the
 * model to name a variant before it knows what it wants to change. The two rules it does enforce
 * are the two mistakes that would otherwise succeed and do the wrong thing: a bare `entryId` is a
 * no-op write with an audit row behind it, and duration-plus-interval is a caller that has not
 * decided how the entry should be timed.
 *
 * ONE half of an interval is deliberately let through. The domain refuses it with
 * `START_END_REQUIRED` rather than merging the missing half with the stored one, and that answer is
 * more precise than anything we could say from here — this layer does not know whether the entry
 * currently has an interval at all, so a refine message would have to guess at the fix.
 */
const inputSchema = z
  .object({
    entryId,
    date: isoDate.optional(),
    projectId: projectId.optional(),
    description: description.optional(),
    durationMinutes: durationMinutes.optional(),
    startTime: localTime.optional(),
    endTime: localTime.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasDuration = value.durationMinutes !== undefined;
    const hasStart = value.startTime !== undefined;
    const hasEnd = value.endTime !== undefined;

    const changesSomething =
      value.date !== undefined ||
      value.projectId !== undefined ||
      value.description !== undefined ||
      hasDuration ||
      hasStart ||
      hasEnd;

    if (!changesSomething) {
      ctx.addIssue({
        code: "custom",
        message:
          "Give at least one field to change besides entryId: date, projectId, description, durationMinutes, or startTime+endTime.",
      });
      return;
    }

    if (hasDuration && (hasStart || hasEnd)) {
      ctx.addIssue({
        code: "custom",
        message: "Give either durationMinutes or startTime+endTime, not both.",
      });
    }
  });

type UpdateEntryArgs = z.infer<typeof inputSchema>;

/**
 * The timing half of the patch, or nothing at all.
 *
 * The domain reads any one of `timingMode`, `durationMinutes`, `startTime` or `endTime` being
 * present as "re-time this entry" and re-derives the interval from scratch; with none of them it
 * keeps the stored timing untouched. So an edit that only moves the description has to send none of
 * the four — an empty object here, not a `timingMode` with undefined companions, which would come
 * back as `DURATION_INVALID` on an entry nobody asked to re-time.
 */
function timingPatch(args: Pick<UpdateEntryArgs, "durationMinutes" | "startTime" | "endTime">) {
  if (args.durationMinutes !== undefined) {
    return { timingMode: "DURATION" as const, durationMinutes: args.durationMinutes };
  }

  // Either half is enough to mean "time this as an interval". A lone half reaches the domain as it
  // was sent, so it answers with START_END_REQUIRED instead of silently keeping the stored other
  // side and writing an interval the caller never described.
  if (args.startTime !== undefined || args.endTime !== undefined) {
    return {
      timingMode: "INTERVAL" as const,
      ...(args.startTime === undefined ? {} : { startTime: args.startTime }),
      ...(args.endTime === undefined ? {} : { endTime: args.endTime }),
    };
  }

  return {};
}

const DESCRIPTION = `Change one existing time entry of the signed-in member. Only the fields you send are changed.

Give at least one field besides \`entryId\`. Timing is replaced as a whole: send \`durationMinutes\`, or both \`startTime\` and \`endTime\` (\`HH:mm\`, 24-hour, in the member's timezone) — never both forms in one call. Send neither and the entry keeps the timing it has, so changing only the description or the project never re-times it.

Moving an entry with \`date\` re-checks the day it lands on, not the day it came from: that day's month must not be locked by a submitted timesheet (\`PERIOD_LOCKED\`), it must not be covered by a full-day leave (\`DAY_ON_LEAVE\`), the project must be assigned on it (\`PROJECT_NOT_AVAILABLE\`), and the day's total including this entry must stay inside 24 hours (\`DAILY_LIMIT_EXCEEDED\`).

Fails with \`ENTRY_NOT_FOUND\` for an id that is not this member's, \`ENTRY_LOCKED\` once a submitted timesheet covers the entry, and \`ENTRY_IS_DECLARED\` for an entry in a month that declares its hours — those are corrected a month at a time in the web app, not here.

Returns the entry as it now stands and its day's new total. A day over 8 hours comes back as a warning, not an error.`;

export const updateEntryTool: McpTool = {
  name: "time_update_entry",
  scope: "time:write",
  register(server, actor) {
    server.registerTool(
      "time_update_entry",
      {
        title: "Edit logged time",
        description: DESCRIPTION,
        inputSchema,
        outputSchema: mutationResult,
        annotations: UPDATE_ANNOTATIONS,
      },
      async (args) =>
        runTool("time_update_entry", async () => {
          await updateTimeEntry({
            memberId: actor.member.id,
            // Both, and both the actor's own. The domain layer treats a mismatch as an admin
            // correction; passing the same id twice is the structural guarantee that an agent can
            // only ever write against the member it was issued a token for.
            actorMemberId: actor.member.id,
            timeEntryId: args.entryId,
            /*
             * Spread only what the caller actually sent. The domain tests presence with
             * `!== undefined` today, so a spread `undefined` happens to be harmless — building the
             * patch from what arrived means no update ever depends on that, and a later "clear this
             * field" branch keyed on the property existing cannot be tripped by a field the caller
             * never mentioned.
             */
            ...(args.date === undefined ? {} : { localDate: parseDateOnly(args.date) }),
            ...(args.projectId === undefined ? {} : { projectId: args.projectId }),
            ...(args.description === undefined ? {} : { description: args.description }),
            ...timingPatch(args),
            requestMetadata: actor.requestMetadata,
          });

          const result = await readMutationResult(actor, { entryId: args.entryId });

          if (!result) {
            /*
             * The update succeeded and the row is gone from the read path, which only happens if
             * something deleted it between the write and the echo. `ENTRY_NOT_FOUND` is what the
             * agent would meet on a retry, and it points at the move that recovers the row —
             * `time_restore_entry` — where an INTERNAL would point at us.
             */
            return fail("ENTRY_NOT_FOUND", "The entry was updated but is no longer readable.", {
              entryId: args.entryId,
            });
          }

          return ok(result, [
            `Updated: ${entryLine(result.entry)}`,
            `${result.day.date} total: ${result.day.totalText}`,
            ...result.warnings,
          ]);
        }),
    );
  },
};
