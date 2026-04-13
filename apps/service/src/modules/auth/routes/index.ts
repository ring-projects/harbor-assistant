import type { FastifyInstance } from "fastify"

import type { ServiceConfig } from "../../../config"
import { PrismaAuthSessionStore } from "../infrastructure/prisma-auth-session-store"
import { PrismaUserIdentityRegistry } from "../../user"
import type { GitHubIdentity } from "../providers/github"
import { registerGitHubAuthRoutes } from "./github-auth.routes"
import { registerAuthSessionRoutes } from "./session.routes"

export async function registerAuthModuleRoutes(
  app: FastifyInstance,
  options: {
    config: ServiceConfig
    githubClient?: {
      exchangeCodeForIdentity(args: {
        code: string
        redirectUri: string
        includeOrganizations?: boolean
      }): Promise<GitHubIdentity>
    }
    githubProvider?: {
      buildAuthorizeUrl(args: {
        redirectUri: string
        state: string
        scopes: string[]
      }): string
      exchangeCodeForIdentity(args: {
        code: string
        redirectUri: string
        includeOrganizations?: boolean
      }): Promise<GitHubIdentity>
    }
    sessionStore?: PrismaAuthSessionStore
    userIdentityRegistry?: PrismaUserIdentityRegistry
  },
) {
  const sessionStore =
    options.sessionStore ?? new PrismaAuthSessionStore(app.prisma)
  const userIdentityRegistry =
    options.userIdentityRegistry ?? new PrismaUserIdentityRegistry(app.prisma)
  await registerGitHubAuthRoutes(app, {
    config: options.config,
    sessionStore,
    userIdentityRegistry,
    githubProvider: options.githubProvider,
    githubClient: options.githubClient,
  })
  await registerAuthSessionRoutes(app, {
    config: options.config,
    sessionStore,
  })
}
