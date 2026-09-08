import { stopRunningTimer } from "@/src/server/time-tracking";

import { fail, ok, runTool } from "../../results";
import { mutationResult, noArguments } from "../../schemas/common";
import { WRITE_ANNOTATIONS, type McpTool } from "../../tool";
import { entryLine, readMutationResult } from "./shared";

const DESCRIPTION = `Stop the running timer and save it as a time entry. Takes no arguments — the project, description and start are whatever \`timer_start\` recorded.

The saved duration is the elapsed time rounded UP to the next whole minute, with a minimum of one minute, so a 20-second timer still saves as 1 minute. A timer started without a description is saved as "Tracked with timer"; call \`time_update_entry\` with the returned entry id to replace that text. The entry is dated to the day the timer STARTED, so a timer left running past midnight still lands on the earlier day.

Fails with \`NO_TIMER_RUNNING\` when nothing is running, and with \`PERIOD_LOCKED\` when the timer's own day has since been locked by a submitted timesheet. \`TIMER_DISCARDED_DAILY_LIMIT\` is different from both: the timer was stopped but NOT saved, because the entry would have taken that day over 24 hours. The elapsed time is discarded and cannot be recovered — report that loss rather than a save.

On success returns the saved entry and the day's new total. A day over 8 hours comes back as a warning, not an error.`;

export const timerStopTool: McpTool = {
  name: "timer_stop",
  scope: "time:write",
  register(server, actor) {
    server.registerTool(
      "timer_stop",
      {
        title: "Stop timer",
        description: DESCRIPTION,
        inputSchema: noArguments,
        outputSchema: mutationResult,
        annotations: WRITE_ANNOTATIONS,
      },
      async () =>
        runTool("timer_stop", async () => {
          const outcome = await stopRunningTimer({
            memberId: actor.member.id,
            // Both ids are the actor's own: the domain layer reads a mismatch as an admin
            // correction, so passing the same id twice is the structural guarantee that a token
            // can only ever stop its own member's timer.
            actorMemberId: actor.member.id,
            requestMetadata: actor.requestMetadata,
          });

          /*
           * The over-limit path is a RETURN VALUE, not a throw: the domain layer hard-deletes the
           * running timer and writes an audit row, so by the time we get here the elapsed work is
           * already gone and there is nothing to retry. Branching on the union — never on an
           * exception — is what keeps that from being reported as a save that happened.
           */
          if ("discarded" in outcome) {
            return fail(
              "TIMER_DISCARDED_DAILY_LIMIT",
              "The timer was stopped without saving, because the entry would have taken that day over 24 hours. The elapsed time was not recorded and cannot be recovered.",
              { reason: outcome.reason },
            );
          }

          const result = await readMutationResult(actor, { entryId: outcome.id });

          if (!result) {
            // The entry exists and the echo does not. Claiming plain success would leave the agent
            // unable to reference or correct the row the timer just produced.
            return fail("INTERNAL", "The timer was saved but the entry could not be read back.", {
              entryId: outcome.id,
            });
          }

          return ok(result, [
            `Timer stopped and saved: ${entryLine(result.entry)}`,
            `${result.day.date} total: ${result.day.totalText}`,
            ...result.warnings,
          ]);
        }),
    );
  },
};
