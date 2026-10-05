import { z } from "zod";

import { MCP_LIMITS } from "../config";

/**
 * The argument and result vocabulary every tool shares.
 *
 * Zod 4 schemas, because `@modelcontextprotocol/server` reads `~standard.jsonSchema` off them to
 * advertise the tool's shape in `tools/list` and `~standard.validate` to check incoming arguments.
 * A raw JSON Schema would need wrapping in `fromJsonSchema`; a Zod 3 schema throws outright.
 *
 * Every object is `.strict()`. A stray argument is a sign the model has guessed at an API that does
 * not exist, and failing loudly is how it learns the real one on the next turn instead of silently
 * getting a different result than it asked for.
 */

/** `YYYY-MM-DD` in the member's own timezone. The server never parses relative words. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
  .describe("Calendar date as YYYY-MM-DD, in the member's timezone.");

/** `HH:mm`, 24-hour, local to the member. */
export const localTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm, 24-hour.")
  .describe("Time of day as HH:mm, 24-hour, in the member's timezone.");

export const durationMinutes = z
  .number()
  .int()
  .min(1)
  .max(MCP_LIMITS.dailyHardLimitMinutes)
  .describe(
    `Whole minutes, 1-${MCP_LIMITS.dailyHardLimitMinutes}. A day cannot exceed ${MCP_LIMITS.dailyHardLimitMinutes} minutes in total.`,
  );

export const projectId = z
  .string()
  .min(1)
  .describe("Project id from time_get_context. Names are not accepted.");

export const entryId = z.string().min(1).describe("Time entry id, as returned by any read tool.");

export const description = z
  .string()
  .min(1)
  .max(MCP_LIMITS.descriptionMaxLength)
  .describe(`What the time was spent on. 1-${MCP_LIMITS.descriptionMaxLength} characters.`);

/** No arguments at all — distinct from an absent `inputSchema`, which changes the handler shape. */
export const noArguments = z.object({}).strict();

export const trackingModeSchema = z.enum(["TRACKED", "DECLARED"]);

export const entrySourceSchema = z.enum(["GRID", "FORM", "TIMER", "DECLARED", "MCP"]);

/**
 * One time entry, as every tool reports it.
 *
 * Durations appear twice on purpose: `durationMinutes` is what the model does arithmetic with, and
 * `durationText` is the same figure in the member's own display format, so the agent can quote back
 * the number the member is used to seeing rather than translating 205 into "3.42" itself and
 * rounding differently than the app does.
 */
export const entryView = z
  .object({
    id: z.string(),
    date: isoDate,
    projectId: z.string(),
    projectName: z.string(),
    durationMinutes: z.number().int(),
    durationText: z.string(),
    startTime: localTime.nullable(),
    endTime: localTime.nullable(),
    description: z.string(),
    source: entrySourceSchema,
    locked: z.boolean(),
    updatedAt: z.string(),
  })
  .strict();

export const dayTotal = z
  .object({
    date: isoDate,
    totalMinutes: z.number().int(),
    totalText: z.string(),
    overSoftLimit: z.boolean(),
  })
  .strict();

export const projectRef = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    isInternal: z.boolean(),
    trackingMode: trackingModeSchema,
    canLogTime: z.boolean(),
    validFrom: isoDate,
    validTo: isoDate.nullable(),
    /**
     * The member's own recent descriptions on this project, most useful first.
     *
     * Advice, not a vocabulary: an agent should reuse the member's wording instead of paraphrasing
     * it, because these strings end up on a report line a human verifies. Empty for a project with
     * no history in the last ninety days.
     */
    recentDescriptions: z.array(z.string()),
  })
  .strict();

export const runningTimerView = z
  .object({
    id: z.string(),
    projectId: z.string(),
    projectName: z.string(),
    description: z.string(),
    startedAt: z.string(),
    elapsedMinutes: z.number().int(),
  })
  .strict();

/**
 * The mutation echo. `warnings` carries the soft signals the web UI shows but the server does not
 * block on — an over-8-hour day, most importantly — so an agent can mention them without having to
 * re-derive the rule.
 */
export const mutationResult = z
  .object({
    entry: entryView,
    day: dayTotal,
    warnings: z.array(z.string()),
  })
  .strict();
