/**
 * The MCP layer's public surface.
 *
 * The split mirrors the rest of the app: the route handler authenticates and authorises, this layer
 * validates arguments and adapts shapes, and every business rule stays in `src/server/time-tracking`.
 * No tool talks to Prisma directly — which is what makes period locks, the 24-hour cap, tracking
 * modes, soft deletes and audit logging apply to an agent automatically rather than by remembering
 * to re-implement them here.
 */
export { McpInvalidTokenError, resolveMcpActor, toAuthInfo } from "./actor";
export type { McpActor, McpActorMember } from "./actor";
export { isDynamicClientRegistrationEnabled, MCP_LIMITS, MCP_RATE_LIMIT } from "./config";
export { DOMAIN_MESSAGE_TO_MCP, mapDomainError, messageForCode } from "./errors";
export type { McpErrorCode, McpErrorDetails, McpMappedError } from "./errors";
export { createMcpRateLimiter, mcpRateLimit } from "./rate-limit";
export type { McpRateLimiter, McpRateLimitVerdict } from "./rate-limit";
export {
  buildServer,
  MCP_SERVER_INFO,
  requiredScopeForRequest,
  scopeForTool,
  TOOLSETS,
} from "./registry";
export type { Toolset } from "./registry";
export { fail, failWithCode, ok, runTool } from "./results";
export {
  MCP_CHALLENGE_SCOPES,
  MCP_RESERVED_SCOPES,
  MCP_SCOPES,
  MCP_TOOL_SCOPES,
  isMcpToolScope,
  parseGrantedScopes,
} from "./scopes";
export type { McpScope, McpToolScope } from "./scopes";
export { authInfoFor, buildMcpHandler } from "./server";
export type { McpTool } from "./tool";
