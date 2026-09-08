import type { Toolset } from "../../registry";
import type { McpToolScope } from "../../scopes";
import type { McpTool } from "../../tool";

import { createEntryTool } from "./create-entry";
import { deleteEntryTool } from "./delete-entry";
import { getContextTool } from "./get-context";
import { listEntriesTool } from "./list-entries";
import { restoreEntryTool } from "./restore-entry";
import { summaryTool } from "./summary";
import { timerStartTool } from "./timer-start";
import { timerStatusTool } from "./timer-status";
import { timerStopTool } from "./timer-stop";
import { updateEntryTool } from "./update-entry";

/**
 * The `time` toolset: one member's own working time.
 *
 * The order is fixed and deliberate — context first because everything else depends on it, then
 * reads, then writes, then the timer. `tools/list` is part of a client's prompt cache, and a list
 * whose order moves between requests invalidates that cache on every call.
 */
const TOOLS: readonly McpTool[] = [
  getContextTool,
  listEntriesTool,
  summaryTool,
  createEntryTool,
  updateEntryTool,
  deleteEntryTool,
  restoreEntryTool,
  timerStartTool,
  timerStopTool,
  timerStatusTool,
];

export const timeToolset: Toolset = {
  id: "time",
  /*
   * `time:read` gates the whole toolset: a token without it sees no time tools at all. The write
   * tools then gate individually below, so a read-only connection gets the four reads and nothing
   * that could change a timesheet.
   */
  requiredScope: "time:read",
  toolScopes: Object.fromEntries(TOOLS.map((tool) => [tool.name, tool.scope])) as Readonly<
    Record<string, McpToolScope>
  >,
  register(server, actor) {
    for (const tool of TOOLS) {
      if (!actor.scopes.has(tool.scope)) continue;

      tool.register(server, actor);
    }
  },
};

/** Exported for the contract-baseline test, which asserts the list and its order deliberately. */
export const TIME_TOOL_NAMES = TOOLS.map((tool) => tool.name);
