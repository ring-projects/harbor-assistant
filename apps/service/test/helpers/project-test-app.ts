import type { ServiceConfig } from "../../src/config"
import authSessionPlugin from "../../src/modules/auth/plugin/auth-session"
import type { PrismaClient } from "@prisma/client"
import Fastify from "fastify"

import {
  createDefaultAuthorizationService,
  createRepositoryAuthorizationOrchestrationQuery,
  createRepositoryAuthorizationProjectQuery,
  createRepositoryAuthorizationTaskQuery,
  createRepositoryAuthorizationWorkspaceQuery,
} from "../../src/modules/authorization"
import type { GitHubAppClient } from "../../src/modules/integration/github/application/github-app-client"
import type { GitHubInstallationRepository } from "../../src/modules/integration/github/application/github-installation-repository"
import type { ProjectRepositoryBindingRepository } from "../../src/modules/integration/github/application/project-repository-binding-repository"
import type { ProjectLocalPathManager } from "../../src/modules/integration/github/application/project-local-path-manager"
import { PrismaGitHubInstallationRepository } from "../../src/modules/integration/github/infrastructure/persistence/prisma-github-installation-repository"
import { PrismaProjectRepositoryBindingRepository } from "../../src/modules/integration/github/infrastructure/persistence/prisma-project-repository-binding-repository"
import { PrismaWorkspaceInstallationRepository } from "../../src/modules/integration/github/infrastructure/persistence/prisma-workspace-installation-repository"
import { InMemoryOrchestrationRepository } from "../../src/modules/orchestration/infrastructure/in-memory-orchestration-repository"
import { InMemoryProjectRepository } from "../../src/modules/project/infrastructure/in-memory-project-repository"
import { PrismaProjectRepository } from "../../src/modules/project/infrastructure/persistence/prisma-project-repository"
import { createSimpleProjectPathPolicy } from "../../src/modules/project/infrastructure/simple-project-path-policy"
import { registerProjectModuleRoutes } from "../../src/modules/project/routes"
import { requireAuthenticatedPreHandler } from "../../src/modules/auth"
import { InMemoryTaskRepository } from "../../src/modules/task/infrastructure/in-memory-task-repository"
import { PrismaWorkspaceRepository } from "../../src/modules/workspace"
import errorHandlerPlugin from "../../src/plugins/error-handler"

export async function createProjectTestApp(
  prisma: PrismaClient,
  options?: {
    installationRepository?: GitHubInstallationRepository
    repositoryBindingRepository?: ProjectRepositoryBindingRepository
    githubAppClient?: GitHubAppClient
    localPathManager?: ProjectLocalPathManager
    projectLocalPathRootDirectory?: string
  },
) {
  const repository = prisma
    ? new PrismaProjectRepository(prisma)
    : new InMemoryProjectRepository()
  const installationRepository =
    options?.installationRepository ??
    new PrismaGitHubInstallationRepository(prisma)
  const workspaceInstallationRepository =
    new PrismaWorkspaceInstallationRepository(prisma)
  const repositoryBindingRepository =
    options?.repositoryBindingRepository ??
    new PrismaProjectRepositoryBindingRepository(prisma)
  const workspaceRepository = new PrismaWorkspaceRepository(prisma)
  const authorization = createDefaultAuthorizationService({
    workspaceQuery:
      createRepositoryAuthorizationWorkspaceQuery(workspaceRepository),
    projectQuery: createRepositoryAuthorizationProjectQuery(repository),
    taskQuery: createRepositoryAuthorizationTaskQuery(
      new InMemoryTaskRepository(),
    ),
    orchestrationQuery: createRepositoryAuthorizationOrchestrationQuery(
      new InMemoryOrchestrationRepository(),
    ),
  })
  const app = Fastify({
    logger: false,
  })

  app.decorate("prisma", prisma)
  await app.register(errorHandlerPlugin)
  await app.register(authSessionPlugin, {
    config: {
      port: 3400,
      host: "127.0.0.1",
      serviceName: "harbor-test",
      database: "postgresql://postgres:postgres@127.0.0.1:5432/harbor_test",
      fileBrowserRootDirectory: "/tmp",
      projectLocalPathRootDirectory: "/tmp/workspaces",
      sandboxRootDirectory: "/tmp/sandboxes",
      publicSkillsRootDirectory: "/tmp/skills",
      nodeEnv: "test",
      isProduction: false,
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
        authorization,
        repository,
        workspaceRepository,
        workspaceInstallationRepository,
        pathPolicy: createSimpleProjectPathPolicy(),
        installationRepository,
        repositoryBindingRepository,
        githubAppClient: options?.githubAppClient,
        localPathManager: options?.localPathManager,
        projectLocalPathRootDirectory: options?.projectLocalPathRootDirectory,
      })
    },
    {
      prefix: "/v1",
    },
  )
  await app.ready()

  return app
}
