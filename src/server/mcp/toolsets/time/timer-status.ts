import { z } from "zod";

import { getRunningTimerForMember } from "@/src/server/time-tracking";

import { ok, runTool } from "../../results";
import { noArguments, runningTimerView } from "../../schemas/common";
import { READ_ONLY_ANNOTATIONS, type McpTool } from "../../tool";
import { elapsedMinutesFor, timerLine } from "./shared";

const outputSchema = z.object({ timer: runningTimerView.nullable() }).strict();

const DESCRIPTION = `Whether a timer is running for the signed-in member right now, and for how long.

No arguments. \`timer: null\` means nothing is running — the normal answer, not an error. \`elapsedMinutes\` is exactly what \`timer_stop\` would save: rounded up to the next whole minute, minimum one.

This is the cheapest tool in the toolset. Prefer it over \`time_get_context\` whenever the timer is the only thing you need.`;

export const timerStatusTool: McpTool = {
  name: "timer_status",
  scope: "time:read",
  register(server, actor) {
    server.registerTool(
      "timer_status",
      {
        title: "Timer status",
        description: DESCRIPTION,
        inputSchema: noArguments,
        outputSchema,
        annotations: READ_ONLY_ANNOTATIONS,
      },
      async () =>
        runTool("timer_status", async () => {
          /*
           * One row, looked up by member id, and nothing else. "What am I tracking?" is the question
           * an agent asks between almost every other call, so this tool has to stay a single read —
           * the moment it grows a day total or a project list it becomes `time_get_context` with a
           * different name, and the cheap answer no longer exists.
           */
          const timer = await getRunningTimerForMember(actor.member.id);

          // Same round-up-with-a-floor-of-one rule `stopRunningTimer` applies, so the figure quoted
          // here is the figure a stop would actually save rather than a second opinion about it.
          const elapsedMinutes = timer ? elapsedMinutesFor(timer.startedAt) : 0;

          const structured = {
            /*
             * A projection, not the domain row: `projectColor` and `projectAssignmentId` exist for
             * the grid to paint and to post back with, and neither means anything to a model. The
             * shape is `runningTimerView` so a timer reads identically here and in the context tool.
             */
            timer: timer
              ? {
                  id: timer.id,
                  projectId: timer.projectId,
                  projectName: timer.projectName,
                  description: timer.description,
                  startedAt: timer.startedAt,
                  elapsedMinutes,
                }
              : null,
          };

          return ok(structured, timerLine(timer, elapsedMinutes, actor));
        }),
    );
  },
};
