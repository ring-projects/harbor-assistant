import type { ServiceConfig } from "../../src/config"
import authSessionPlugin from "../../src/modules/auth/plugin/auth-session"
import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"

import type { GitHubAppClient } from "../../src/modules/integration/github/application/github-app-client"
import type { GitHubInstallationRepository } from "../../src/modules/integration/github/application/github-installation-repository"
import type { ProjectRepositoryBindingRepository } from "../../src/modules/integration/github/application/project-repository-binding-repository"
import type { ProjectWorkspaceManager } from "../../src/modules/integration/github/application/project-workspace-manager"
import { PrismaGitHubInstallationRepository } from "../../src/modules/integration/github/infrastructure/persistence/prisma-github-installation-repository"
import { PrismaProjectRepositoryBindingRepository } from "../../src/modules/integration/github/infrastructure/persistence/prisma-project-repository-binding-repository"
import { InMemoryProjectRepository } from "../../src/modules/project/infrastructure/in-memory-project-repository"
import { PrismaProjectRepository } from "../../src/modules/project/infrastructure/persistence/prisma-project-repository"
import { createSimpleProjectPathPolicy } from "../../src/modules/project/infrastructure/simple-project-path-policy"
import { registerProjectModuleRoutes } from "../../src/modules/project/routes"
import { requireAuthenticatedPreHandler } from "../../src/modules/auth"
import errorHandlerPlugin from "../../src/plugins/error-handler"

export async function createProjectTestApp(
  prisma: PrismaClient,
  options?: {
    installationRepository?: GitHubInstallationRepository
    repositoryBindingRepository?: ProjectRepositoryBindingRepository
    githubAppClient?: GitHubAppClient
    workspaceManager?: ProjectWorkspaceManager
    workspaceRootDirectory?: string
  },
) {
  const repository = prisma
    ? new PrismaProjectRepository(prisma)
    : new InMemoryProjectRepository()
  const installationRepository =
    options?.installationRepository ?? new PrismaGitHubInstallationRepository(prisma)
  const repositoryBindingRepository =
    options?.repositoryBindingRepository ??
    new PrismaProjectRepositoryBindingRepository(prisma)
  const app = Fastify({
    logger: false,
  })

  app.decorate("prisma", prisma)
  await app.register(errorHandlerPlugin)
  await app.register(authSessionPlugin, {
    config: {
      port: 3400,
      host: "127.0.0.1",
      trustProxy: false,
      serviceName: "harbor-test",
      database: "file:test.sqlite",
      fileBrowserRootDirectory: "/tmp",
      nodeEnv: "test",
      isProduction: false,
      harborConfigPath: "/tmp/harbor-config.yaml",
      harborHomeDirectory: "/tmp/.harbor",
      taskDatabaseFile: "/tmp/task.sqlite",
      appBaseUrl: "http://127.0.0.1:3400",
      webBaseUrl: "http://127.0.0.1:3000",
      githubClientId: undefined,
      githubClientSecret: undefined,
      githubAppSlug: undefined,
      githubAppId: undefined,
      githubAppPrivateKey: undefined,
      githubAppWebhookSecret: undefined,
      allowedGitHubUsers: [],
      allowedGitHubOrgs: [],
    } satisfies ServiceConfig,
  })
  await app.register(
    async (instance) => {
      instance.addHook("preHandler", requireAuthenticatedPreHandler)
      await registerProjectModuleRoutes(instance, {
        repository,
        pathPolicy: createSimpleProjectPathPolicy(),
        installationRepository,
        repositoryBindingRepository,
        githubAppClient: options?.githubAppClient,
        workspaceManager: options?.workspaceManager,
        workspaceRootDirectory: options?.workspaceRootDirectory,
      })
    },
    {
      prefix: "/v1",
    },
  )
  await app.ready()

  return app
}
