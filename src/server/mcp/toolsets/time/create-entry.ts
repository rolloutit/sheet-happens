import { z } from "zod";

import { createTimeEntry, parseDateOnly } from "@/src/server/time-tracking";

import { MCP_LIMITS } from "../../config";
import { fail, ok, runTool } from "../../results";
import {
  description,
  durationMinutes,
  isoDate,
  localTime,
  mutationResult,
  projectId,
} from "../../schemas/common";
import { WRITE_ANNOTATIONS, type McpTool } from "../../tool";
import { entryLine, readMutationResult } from "./shared";

/**
 * Either a duration or an interval, never both and never neither.
 *
 * `superRefine` rather than a discriminated union: the model does not have to know which "mode" it
 * is in, and the message names the mistake precisely enough that a wrong guess is corrected on the
 * next turn instead of retried.
 */
const inputSchema = z
  .object({
    date: isoDate,
    projectId,
    description,
    durationMinutes: durationMinutes.optional(),
    startTime: localTime.optional(),
    endTime: localTime.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasDuration = value.durationMinutes !== undefined;
    const hasStart = value.startTime !== undefined;
    const hasEnd = value.endTime !== undefined;

    if (hasDuration && (hasStart || hasEnd)) {
      ctx.addIssue({
        code: "custom",
        message: "Give either durationMinutes or startTime+endTime, not both.",
      });
      return;
    }

    if (!hasDuration && !(hasStart && hasEnd)) {
      ctx.addIssue({
        code: "custom",
        message: "Give durationMinutes, or both startTime and endTime.",
      });
    }
  });

const DESCRIPTION = `Log time for the signed-in member on one calendar day.

Give either \`durationMinutes\` (integer, 1-${MCP_LIMITS.dailyHardLimitMinutes}) or both \`startTime\` and \`endTime\` (\`HH:mm\`, 24-hour, in the member's timezone) — not both, not neither. An interval whose end is at or before its start is read as running past midnight. \`date\` is \`YYYY-MM-DD\` in the member's timezone; call \`time_get_context\` for today's date and the valid \`projectId\` values.

Fails if the month has a submitted timesheet (\`PERIOD_LOCKED\`), if the member is on full-day leave that day (\`DAY_ON_LEAVE\`), if the project declares its hours monthly (\`PROJECT_DECLARES_MONTHLY\`), if the project is not assigned on that date (\`PROJECT_NOT_AVAILABLE\`), or if the day would exceed 24 hours (\`DAILY_LIMIT_EXCEEDED\`).

Returns the created entry and the day's new total. A day over 8 hours comes back as a warning, not an error.`;

export const createEntryTool: McpTool = {
  name: "time_create_entry",
  scope: "time:write",
  register(server, actor) {
    server.registerTool(
      "time_create_entry",
      {
        title: "Log time",
        description: DESCRIPTION,
        inputSchema,
        outputSchema: mutationResult,
        annotations: WRITE_ANNOTATIONS,
      },
      async (args) =>
        runTool("time_create_entry", async () => {
          const created = await createTimeEntry({
            memberId: actor.member.id,
            // Both, and both the actor's own. The domain layer treats a mismatch as an admin
            // correction; passing the same id twice is the structural guarantee that an agent can
            // only ever write against the member it was issued a token for.
            actorMemberId: actor.member.id,
            projectId: args.projectId,
            localDate: parseDateOnly(args.date),
            description: args.description,
            ...(args.durationMinutes === undefined
              ? {
                  timingMode: "INTERVAL" as const,
                  startTime: args.startTime,
                  endTime: args.endTime,
                }
              : { timingMode: "DURATION" as const, durationMinutes: args.durationMinutes }),
            source: "MCP",
            requestMetadata: actor.requestMetadata,
          });

          const result = await readMutationResult(actor, { entryId: created.id });

          if (!result) {
            // The write succeeded and the read back did not. Reporting success without the echo
            // would leave the agent unable to reference what it just made.
            return fail("INTERNAL", "The entry was created but could not be read back.", {
              entryId: created.id,
            });
          }

          return ok(result, [
            `Logged: ${entryLine(result.entry)}`,
            `${result.day.date} total: ${result.day.totalText}`,
            ...result.warnings,
          ]);
        }),
    );
  },
};
