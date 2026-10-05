import { z } from "zod";

import { getMemberTrackingContext } from "@/src/server/time-tracking";

import { MCP_LIMITS } from "../../config";
import { ok, runTool } from "../../results";
import { noArguments, projectRef, runningTimerView } from "../../schemas/common";
import { READ_ONLY_ANNOTATIONS, type McpTool } from "../../tool";
import { durationText, elapsedMinutesFor } from "./shared";

const outputSchema = z
  .object({
    member: z
      .object({
        id: z.string(),
        displayName: z.string(),
        timezone: z.string(),
        locale: z.string(),
        durationDisplayFormat: z.enum(["DECIMAL_HOURS", "HOURS_MINUTES"]),
        profile: z.enum(["EMPLOYEE", "CONTRACTOR"]),
      })
      .strict(),
    today: z.string(),
    week: z.object({ start: z.string(), end: z.string() }).strict(),
    month: z.object({ start: z.string(), end: z.string() }).strict(),
    limits: z
      .object({
        dailySoftWarningMinutes: z.number().int(),
        dailyHardLimitMinutes: z.number().int(),
        descriptionMaxLength: z.number().int(),
        listRangeDays: z.number().int(),
        summaryRangeDays: z.number().int(),
      })
      .strict(),
    projects: z.array(projectRef),
    lockedMonths: z.array(z.string()),
    runningTimer: runningTimerView.nullable(),
    scopes: z.array(z.string()),
  })
  .strict();

const DESCRIPTION = `Who you are acting for, and everything needed to make a valid call. Call this first.

Returns the member's timezone and today's date in it, the current week and month, the project ids you may log against, which months are locked by a submitted timesheet, any running timer, and the argument limits every other tool enforces.

Dates in this API are never relative: work out YYYY-MM-DD yourself from \`today\`. Projects are addressed by \`id\` — names are not accepted. A project with \`canLogTime: false\` declares its hours a month at a time and will refuse individual entries.

Each project also carries \`recentDescriptions\`: how this member has actually been describing their work there lately, most useful first. Reuse that wording when it fits what you are logging instead of paraphrasing it — these descriptions reach a report line and a contractor invoice, where an outlier phrasing reads as a mistake.`;

export const getContextTool: McpTool = {
  name: "time_get_context",
  scope: "time:read",
  register(server, actor) {
    server.registerTool(
      "time_get_context",
      {
        title: "Get tracking context",
        description: DESCRIPTION,
        inputSchema: noArguments,
        outputSchema,
        annotations: READ_ONLY_ANNOTATIONS,
      },
      async () =>
        runTool("time_get_context", async () => {
          const context = await getMemberTrackingContext({ memberId: actor.member.id });

          const runningTimer = context.runningTimer
            ? {
                id: context.runningTimer.id,
                projectId: context.runningTimer.projectId,
                projectName: context.runningTimer.projectName,
                description: context.runningTimer.description,
                startedAt: context.runningTimer.startedAt,
                elapsedMinutes: elapsedMinutesFor(context.runningTimer.startedAt),
              }
            : null;

          const structured = {
            member: {
              id: context.member.id,
              displayName: context.member.displayName,
              timezone: context.member.timezone,
              locale: context.member.locale,
              durationDisplayFormat: context.member.durationDisplayFormat,
              profile: context.member.profile,
            },
            today: context.today,
            week: context.week,
            month: context.month,
            limits: {
              dailySoftWarningMinutes: MCP_LIMITS.dailySoftWarningMinutes,
              dailyHardLimitMinutes: MCP_LIMITS.dailyHardLimitMinutes,
              descriptionMaxLength: MCP_LIMITS.descriptionMaxLength,
              listRangeDays: MCP_LIMITS.listRangeDays,
              summaryRangeDays: MCP_LIMITS.summaryRangeDays,
            },
            projects: context.projects.map((project) => ({
              id: project.projectId,
              name: project.name,
              color: project.color,
              isInternal: project.isInternal,
              trackingMode: project.trackingMode,
              canLogTime: project.canLogTime,
              validFrom: project.validFrom,
              validTo: project.validTo,
              recentDescriptions: project.recentDescriptions,
            })),
            lockedMonths: context.lockedMonths,
            runningTimer,
            // The granted scopes, so an agent can tell a read-only connection from a writable one
            // before it tries a mutation and collects a 403.
            scopes: [...actor.scopes],
          };

          const lines = [
            `Acting for ${context.member.displayName} (${context.member.timezone}). Today is ${context.today}.`,
            `Week ${context.week.start}..${context.week.end}, month ${context.month.start}..${context.month.end}.`,
            context.projects.length
              ? `Projects: ${context.projects
                  .map(
                    (project) =>
                      `${project.name} (${project.projectId})${project.canLogTime ? "" : " [declares monthly]"}`,
                  )
                  .join("; ")}`
              : "No projects are assigned for this month.",
            context.lockedMonths.length
              ? `Locked months: ${context.lockedMonths.join(", ")}`
              : "No locked months.",
            runningTimer
              ? `Timer running on ${runningTimer.projectName} for ${durationText(runningTimer.elapsedMinutes, actor)}.`
              : "No timer is running.",
          ];

          return ok(structured, lines);
        }),
    );
  },
};
