import { z } from "zod";

import {
  getRunningTimerForMember,
  startRunningTimer,
  TimeTrackingError,
  type RunningTimerView,
} from "@/src/server/time-tracking";

import { fail, ok, runTool } from "../../results";
import { description, projectId, runningTimerView } from "../../schemas/common";
import { WRITE_ANNOTATIONS, type McpTool } from "../../tool";
import { elapsedMinutesFor, timerLine } from "./shared";

const inputSchema = z
  .object({
    projectId,
    description: description.optional(),
  })
  .strict();

const outputSchema = z.object({ timer: runningTimerView }).strict();

/**
 * What a timer nobody labelled is called.
 *
 * `startRunningTimer` normalizes the description and rejects an empty one before it touches the
 * database, so "optional" on the wire has to become *something* here. This is the same literal
 * `stopRunningTimer` falls back to for a timer stopped with a blank description — one wording for an
 * unlabelled timer wherever it was started from, rather than a second one only MCP produces. The
 * agent can replace it after the stop with `time_update_entry` on the returned entry.
 */
const DEFAULT_DESCRIPTION = "Tracked with timer";

const DESCRIPTION = `Start a running timer for the signed-in member on one project.

Nothing reaches the timesheet until \`timer_stop\`, and the entry that stop creates is attributed to the day the timer STARTED, in the member's timezone — a session running past midnight lands on the earlier day, not the day it was stopped.

\`projectId\` comes from \`time_get_context\`; names are not accepted. A project with \`canLogTime: false\` declares its hours a month at a time and cannot be timed (\`PROJECT_DECLARES_MONTHLY\`). \`description\` is optional and becomes "${DEFAULT_DESCRIPTION}" when omitted; after the stop it can be changed with \`time_update_entry\`.

A member can have one timer at a time. If one is already running this fails with \`TIMER_ALREADY_RUNNING\` and returns that timer in \`details.timer\`, so you can tell the member what would be stopped before you stop it. It also fails if the day's month has a submitted timesheet (\`PERIOD_LOCKED\`) or the project is not assigned today (\`PROJECT_NOT_AVAILABLE\`).

Returns the running timer and how long it has been going.`;

export const timerStartTool: McpTool = {
  name: "timer_start",
  scope: "time:write",
  register(server, actor) {
    server.registerTool(
      "timer_start",
      {
        title: "Start timer",
        description: DESCRIPTION,
        inputSchema,
        outputSchema,
        annotations: WRITE_ANNOTATIONS,
      },
      async (args) =>
        runTool("timer_start", async () => {
          try {
            await startRunningTimer({
              memberId: actor.member.id,
              // Both, and both the actor's own — the same structural guarantee the entry writes
              // make: an agent can only ever act for the member its token was issued for.
              actorMemberId: actor.member.id,
              projectId: args.projectId,
              description: args.description ?? DEFAULT_DESCRIPTION,
              requestMetadata: actor.requestMetadata,
            });
          } catch (error) {
            if (!(error instanceof TimeTrackingError && error.code === "TIMER_ALREADY_RUNNING")) {
              // Everything else is `runTool`'s job: it owns the domain-code mapping, and a second
              // translation here would be the one that drifts.
              throw error;
            }

            /*
             * The one domain failure worth enriching. "Stop the running timer first" tells an agent
             * what to do and nothing about whether it should: stopping saves an entry, and a timer
             * left running over lunch is not the same decision as one started two minutes ago. So
             * the timer travels with the error rather than costing a `timer_status` round trip that
             * the agent would have to know to make.
             */
            const running = await getRunningTimerForMember(actor.member.id);

            return fail(
              "TIMER_ALREADY_RUNNING",
              "A timer is already running for this member. Stop it with timer_stop before starting another one.",
              // Absent only if that timer was stopped between the rejected start and this read — a
              // race, not a different state, so it keeps the same code rather than retrying blind.
              running ? { timer: toTimerView(running) } : undefined,
            );
          }

          // The write returns only `{ id }`. Project name and start instant come from the read path
          // instead, which is the same one `/time` renders from — so a figure quoted back to the
          // member cannot disagree with the one on screen.
          const timer = await getRunningTimerForMember(actor.member.id);

          if (!timer) {
            // The timer is running and we cannot describe it. Reporting success without the echo
            // would leave the agent unable to reference what it just started.
            return fail("INTERNAL", "The timer was started but could not be read back.");
          }

          const view = toTimerView(timer);

          return ok({ timer: view }, [
            `Timer started on ${view.projectName}: ${view.description}`,
            timerLine(timer, view.elapsedMinutes, actor),
          ]);
        }),
    );
  },
};

/**
 * `elapsedMinutes` is rounded exactly the way a stop rounds it — up, with a floor of one — so a
 * timer started this second reports one minute rather than zero, and the number an agent reads here
 * is the number `timer_stop` would actually save.
 */
function toTimerView(timer: RunningTimerView) {
  return {
    id: timer.id,
    projectId: timer.projectId,
    projectName: timer.projectName,
    description: timer.description,
    startedAt: timer.startedAt,
    elapsedMinutes: elapsedMinutesFor(timer.startedAt),
  };
}
