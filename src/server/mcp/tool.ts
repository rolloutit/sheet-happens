import type { McpServer } from "@modelcontextprotocol/server";

import type { McpActor } from "./actor";
import type { McpToolScope } from "./scopes";

/**
 * One tool: its name, the scope it needs, and how it registers itself.
 *
 * The scope lives on the tool rather than only on the toolset because reading and writing are
 * separable — a token granted `time:read` alone must see the four read tools and not the six that
 * mutate. The route needs the same mapping *before* the server is built, to answer a write attempt
 * with a 403 challenge instead of a tool error, which is why `name` and `scope` are plain data.
 */
export type McpTool = {
  name: string;
  scope: McpToolScope;
  register: (server: McpServer, actor: McpActor) => void;
};

/**
 * Annotation sets, spelled out rather than defaulted.
 *
 * The SDK emits annotations exactly as given and applies no defaults, while the spec's *client*-side
 * reading of an absent hint is the pessimistic one (`destructiveHint: true`, `openWorldHint: true`).
 * Staying silent would therefore have every read tool look destructive and every tool look like it
 * touches the open internet.
 *
 * `openWorldHint: false` everywhere: this server talks to one Postgres database that the member
 * already owns, never to the outside world.
 */
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

/** An update: not destructive (the previous value is recoverable from the audit log), idempotent. */
export const UPDATE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const RESTORE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

/**
 * Marks a tool as always needing a human click in Claude, whatever the user's auto-approve setting.
 *
 * Only `time_delete_entry` carries it. Deletion is the one action members regret; it is a soft
 * delete with a restore tool behind it, but a confirmation costs one click and an accidental sweep
 * of a week costs an afternoon. Updates and timer stops stay frictionless.
 */
export const REQUIRES_USER_INTERACTION = {
  "anthropic/requiresUserInteraction": true,
} as const;
