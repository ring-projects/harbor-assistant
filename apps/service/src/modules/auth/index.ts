export { HARBOR_SESSION_COOKIE_NAME } from "./constants"
export { registerAgentTokenRoutes, registerAuthModuleRoutes } from "./routes"
export {
  default as authSessionPlugin,
  getAuthenticatedActor,
  requireAuthenticatedPreHandler,
  requireAuthenticatedRequest,
  requireUserAuthenticatedRequest,
} from "./plugin/auth-session"
export {
  PrismaAuthSessionStore,
  type AuthenticatedRequestContext,
} from "./infrastructure/prisma-auth-session-store"
export { PrismaAgentTokenStore } from "./infrastructure/prisma-agent-token-store"
export {
  DEFAULT_AGENT_TOKEN_TTL_SECONDS,
  MAX_AGENT_TOKEN_TTL_SECONDS,
  normalizeAgentTokenScopes,
  toAuthorizationAgentActor,
  type AgentTokenRecord,
  type AgentTokenScope,
} from "./application/agent-token"
