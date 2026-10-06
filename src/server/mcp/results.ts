import type { CallToolResult } from "@modelcontextprotocol/server";

import { mapDomainError, messageForCode, type McpErrorCode, type McpErrorDetails } from "./errors";

/**
 * Every tool answers on two channels at once.
 *
 * `structuredContent` is the contract — validated against the tool's `outputSchema` before the
 * result leaves the server, so a drift between schema and handler is a loud failure rather than a
 * model quietly reading a field that is not there. The text block is the same data flattened, for
 * legacy clients and UIs that only render text.
 *
 * The text is DATA, never instructions. User-authored descriptions are echoed inside it verbatim and
 * never concatenated into guidance the model might follow — that is this server's share of the
 * prompt-injection mitigation, and the reason no tool ever writes a sentence like "you should now…".
 */

export function ok<T extends Record<string, unknown>>(
  structuredContent: T,
  text: string | readonly string[],
): CallToolResult {
  const lines = typeof text === "string" ? [text] : text;

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    structuredContent,
  };
}

/**
 * A failure the model can react to: wrong project, locked month, missing entry.
 *
 * Deliberately NOT a JSON-RPC error. The spec reserves those for what the model cannot fix — a bad
 * token, a missing scope, an unknown tool — and a transport-level error gives the model nothing to
 * work with. `isError: true` with a code it can branch on does.
 */
export function fail(
  code: McpErrorCode,
  message: string,
  details?: McpErrorDetails,
): CallToolResult {
  return {
    content: [{ type: "text", text: `${code}: ${message}` }],
    structuredContent: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    isError: true,
  };
}

export function failWithCode(code: McpErrorCode, details?: McpErrorDetails): CallToolResult {
  return fail(code, messageForCode(code), details);
}

/**
 * The wrapper every tool handler body goes through.
 *
 * Without it, a domain throw would be caught by the SDK and flattened into
 * `{ content: [{ text: <the raw Error message> }], isError: true }` — no code for the model to
 * branch on, and the raw message on the wire. Mapping here keeps the closed union closed.
 *
 * `logLabel` names the tool in the server log; the correlation id is the only thing tying a generic
 * `INTERNAL` the model saw to the real stack in the log.
 */
export async function runTool(
  logLabel: string,
  handler: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await handler();
  } catch (error) {
    const mapped = mapDomainError(error);

    if (mapped.code === "INTERNAL") {
      console.error(`[mcp] ${logLabel} failed`, { correlationId: mapped.correlationId }, error);

      return fail(mapped.code, mapped.message, { correlationId: mapped.correlationId });
    }

    return fail(mapped.code, mapped.message, mapped.details);
  }
}
