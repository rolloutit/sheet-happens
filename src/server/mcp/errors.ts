import {
  TimeTrackingDateError,
  TimeTrackingError,
  type TimeTrackingDateErrorCode,
  type TimeTrackingErrorCode,
} from "@/src/server/time-tracking";

/**
 * The closed set of failures a tool can report back to a model.
 *
 * These are read by an agent, not a person, so they are English and stable — the model narrates the
 * outcome to the user in the user's own language. Renaming one is a breaking wire change; adding one
 * is not.
 *
 * Deliberately coarser than `TimeTrackingErrorCode`: the domain distinguishes "not active for this
 * date" from "not assigned for this week" because its two callers look up assignments differently,
 * while an agent's only useful move is the same either way — re-read the context and pick another
 * project.
 */
export type McpErrorCode =
  | "VALIDATION"
  | "MEMBER_NOT_FOUND"
  | "PROJECT_REQUIRED"
  | "PROJECT_NOT_AVAILABLE"
  | "PROJECT_DECLARES_MONTHLY"
  | "INVALID_DATE"
  | "INVALID_TIME"
  | "END_BEFORE_START"
  | "START_END_REQUIRED"
  | "DURATION_INVALID"
  | "DAILY_LIMIT_EXCEEDED"
  | "DESCRIPTION_REQUIRED"
  | "DESCRIPTION_TOO_LONG"
  | "ENTRY_NOT_FOUND"
  | "ENTRY_LOCKED"
  | "ENTRY_IS_DECLARED"
  | "PERIOD_LOCKED"
  | "TIMER_ALREADY_RUNNING"
  | "NO_TIMER_RUNNING"
  | "TIMER_DISCARDED_DAILY_LIMIT"
  | "RANGE_TOO_LARGE"
  | "CURSOR_INVALID"
  | "INTERNAL";

export type McpErrorDetails = Record<string, unknown>;

export type McpMappedError = {
  code: McpErrorCode;
  message: string;
  details?: McpErrorDetails;
};

/**
 * The primary map: domain code → wire code.
 *
 * Keying on the code rather than the English sentence is the point of
 * `TimeTrackingError.code` — a reworded message no longer silently changes what an agent sees.
 * `satisfies` makes adding a domain code a compile error here rather than an `INTERNAL` at runtime.
 */
const DOMAIN_CODE_TO_MCP = {
  MEMBER_NOT_FOUND: "MEMBER_NOT_FOUND",
  ENTRY_NOT_FOUND: "ENTRY_NOT_FOUND",
  ENTRY_LOCKED: "ENTRY_LOCKED",
  ENTRY_IS_DECLARED: "ENTRY_IS_DECLARED",
  PERIOD_LOCKED: "PERIOD_LOCKED",
  // Only reachable through the inactive-week tools, which v1 does not expose. Mapped rather than
  // omitted so a later toolset cannot accidentally surface it as INTERNAL.
  WEEK_LOCKED: "PERIOD_LOCKED",
  PROJECT_REQUIRED: "PROJECT_REQUIRED",
  PROJECT_NOT_AVAILABLE: "PROJECT_NOT_AVAILABLE",
  PROJECT_NOT_ASSIGNED_FOR_WEEK: "PROJECT_NOT_AVAILABLE",
  PROJECT_DECLARES_MONTHLY: "PROJECT_DECLARES_MONTHLY",
  DURATION_INVALID: "DURATION_INVALID",
  DAILY_LIMIT_EXCEEDED: "DAILY_LIMIT_EXCEEDED",
  START_END_REQUIRED: "START_END_REQUIRED",
  END_BEFORE_START: "END_BEFORE_START",
  INVALID_DATE: "INVALID_DATE",
  INVALID_TIME: "INVALID_TIME",
  DESCRIPTION_REQUIRED: "DESCRIPTION_REQUIRED",
  DESCRIPTION_TOO_LONG: "DESCRIPTION_TOO_LONG",
  TIMER_ALREADY_RUNNING: "TIMER_ALREADY_RUNNING",
  NO_TIMER_RUNNING: "NO_TIMER_RUNNING",
  INACTIVE_WEEK_HAS_ENTRIES: "VALIDATION",
  DRAFT_KEY_INVALID: "VALIDATION",
  INVALID_CURSOR: "CURSOR_INVALID",
  // A timezone the runtime cannot format is our bug, not something the model can act on.
  TIMEZONE_FORMAT: "INTERNAL",
} satisfies Record<TimeTrackingErrorCode | TimeTrackingDateErrorCode, McpErrorCode>;

/**
 * The fallback map: exact domain sentence → wire code.
 *
 * Redundant with `DOMAIN_CODE_TO_MCP` today and deliberately kept anyway. It covers the errors that
 * reach us as a plain `Error` — the copy/duplicate helpers re-wrap, and neighbouring domains
 * (`declarations.ts`) throw their own classes — and `errors.test.ts` asserts every sentence in it
 * still exists in `src/server/time-tracking`, so a rename fails loudly in CI instead of degrading a
 * tool result to `INTERNAL` in production.
 */
export const DOMAIN_MESSAGE_TO_MCP: Record<string, McpErrorCode> = {
  "Member not found.": "MEMBER_NOT_FOUND",
  "Time entry not found.": "ENTRY_NOT_FOUND",
  "This entry is locked by a submitted timesheet.": "ENTRY_LOCKED",
  "Declared hours are corrected on the month level.": "ENTRY_IS_DECLARED",
  "This period is locked by a submitted timesheet.": "PERIOD_LOCKED",
  "This week touches a locked period.": "PERIOD_LOCKED",
  "Choose a project.": "PROJECT_REQUIRED",
  "This project is not active for the selected date.": "PROJECT_NOT_AVAILABLE",
  "This project is not assigned for the selected week.": "PROJECT_NOT_AVAILABLE",
  "This project declares its hours monthly.": "PROJECT_DECLARES_MONTHLY",
  "Duration must be greater than zero.": "DURATION_INVALID",
  "Daily total cannot exceed 24 hours.": "DAILY_LIMIT_EXCEEDED",
  "Start and end time are required.": "START_END_REQUIRED",
  "Timer end time must be after start time.": "END_BEFORE_START",
  "End time must be after start time.": "END_BEFORE_START",
  "Choose a valid date.": "INVALID_DATE",
  "Choose a valid time.": "INVALID_TIME",
  "Choose a valid start time.": "INVALID_TIME",
  "Choose a valid end time.": "INVALID_TIME",
  "Description is required.": "DESCRIPTION_REQUIRED",
  "Description must be 1000 characters or less.": "DESCRIPTION_TOO_LONG",
  "Stop the running timer before starting another one.": "TIMER_ALREADY_RUNNING",
  "No timer is running.": "NO_TIMER_RUNNING",
  "Could not format date in timezone.": "INTERNAL",
};

/**
 * Model-facing replacements for the codes whose domain sentence assumes a person looking at a grid.
 * Everything absent here keeps the domain's own wording, which is already a plain statement of the
 * rule.
 */
const MESSAGE_OVERRIDES: Partial<Record<McpErrorCode, string>> = {
  PROJECT_NOT_AVAILABLE:
    "That project is not available to log time against on that date. Call time_get_context for the projects you can use.",
  PROJECT_DECLARES_MONTHLY:
    "That project declares its hours a month at a time, so individual entries cannot be written for it.",
  PERIOD_LOCKED: "That period is locked by a submitted timesheet and can no longer be changed.",
  ENTRY_LOCKED: "That entry is locked by a submitted timesheet and can no longer be changed.",
  ENTRY_IS_DECLARED:
    "That entry belongs to a declared month, which is corrected on the month level rather than per entry.",
  CURSOR_INVALID:
    "That page cursor is not usable. Ask again without a cursor to start from the first page.",
  INTERNAL: "Sheet Happens could not complete the request.",
};

export function messageForCode(code: McpErrorCode, domainMessage?: string) {
  return (
    MESSAGE_OVERRIDES[code] ?? domainMessage ?? "Sheet Happens could not complete the request."
  );
}

/**
 * Turns anything thrown by the domain layer into the tool-result error contract.
 *
 * An unmapped throw becomes `INTERNAL` with a generic message and a correlation id — never the raw
 * message, which could carry a stack, a SQL fragment or another member's data. The caller is
 * expected to log `correlationId` alongside the real error.
 */
export function mapDomainError(
  error: unknown,
  details?: McpErrorDetails,
): McpMappedError & { correlationId?: string } {
  if (error instanceof TimeTrackingError || error instanceof TimeTrackingDateError) {
    const code = DOMAIN_CODE_TO_MCP[error.code];

    return {
      code,
      message: messageForCode(code, error.message),
      ...(details ? { details } : {}),
    };
  }

  if (error instanceof Error) {
    const mapped = DOMAIN_MESSAGE_TO_MCP[error.message];

    if (mapped) {
      return {
        code: mapped,
        message: messageForCode(mapped, error.message),
        ...(details ? { details } : {}),
      };
    }
  }

  return {
    code: "INTERNAL",
    message: messageForCode("INTERNAL"),
    correlationId: crypto.randomUUID(),
    ...(details ? { details } : {}),
  };
}
