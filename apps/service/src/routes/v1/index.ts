import fastifyCookie from "@fastify/cookie"
import type { PrismaClient } from "@prisma/client"
import type { FastifyInstance } from "fastify"

import { registerAgentRoutes } from "./agent.routes"
import type { ServiceConfig } from "../../config"
import {
  createBackgroundJobWorker,
  enqueueProjectSandboxTemplateBootstrapJobUseCase,
  PrismaBackgroundJobRepository,
  runProjectSandboxTemplateBootstrapJobUseCase,
} from "../../modules/background-job"
import {
  createDefaultAuthorizationService,
  createRepositoryAuthorizationOrchestrationQuery,
  createRepositoryAuthorizationProjectQuery,
  createRepositoryAuthorizationTaskQuery,
  createRepositoryAuthorizationWorkspaceQuery,
} from "../../modules/authorization"
import {
  HARBOR_SESSION_COOKIE_NAME,
  PrismaAgentTokenStore,
  PrismaAuthSessionStore,
  authSessionPlugin,
  registerAgentTokenRoutes,
  registerAuthModuleRoutes,
  requireAuthenticatedPreHandler,
} from "../../modules/auth"
import { NodeGitHubAppClient } from "../../modules/integration/github/infrastructure/node-github-app-client"
import { createNodeProjectLocalPathManager } from "../../modules/integration/github/infrastructure/node-project-local-path-manager"
import { PrismaGitHubInstallationRepository } from "../../modules/integration/github/infrastructure/persistence/prisma-github-installation-repository"
import { PrismaProjectRepositoryBindingRepository } from "../../modules/integration/github/infrastructure/persistence/prisma-project-repository-binding-repository"
import { PrismaWorkspaceInstallationRepository } from "../../modules/integration/github/infrastructure/persistence/prisma-workspace-installation-repository"
import { registerGitHubIntegrationRoutes } from "../../modules/integration/github/routes"
import { createNodeFileSystemRepository } from "../../modules/filesystem/infrastructure/node-filesystem-repository"
import { registerFileSystemModuleRoutes } from "../../modules/filesystem/routes"
import { createGitCommandRepository } from "../../modules/git/infrastructure/git-command-repository"
import { createNodeGitPathWatcher } from "../../modules/git/infrastructure/node-git-path-watcher"
import { registerGitModuleRoutes } from "../../modules/git/routes"
import { createInteractionSocketGateway } from "../../modules/interaction/infrastructure/socket-io-gateway"
import { PrismaOrchestrationBootstrapStore } from "../../modules/orchestration/infrastructure/persistence/prisma-orchestration-bootstrap-store"
import { PrismaOrchestrationRepository } from "../../modules/orchestration/infrastructure/persistence/prisma-orchestration-repository"
import { createOrchestrationScheduler } from "../../modules/orchestration/infrastructure/orchestration-scheduler"
import { registerOrchestrationModuleRoutes } from "../../modules/orchestration/routes"
import { createNodeProjectPathPolicy } from "../../modules/project/infrastructure/node-project-path-policy"
import { PrismaProjectRepository } from "../../modules/project/infrastructure/persistence/prisma-project-repository"
import { registerProjectModuleRoutes } from "../../modules/project/routes"
import {
  createConfiguredSandboxServices,
  registerSandboxModuleRoutes,
} from "../../modules/sandbox"
import { createCurrentTaskRuntimePort } from "../../modules/task/facade/current-task-runtime-port"
import { createNodeTaskInputFileStore } from "../../modules/task/infrastructure/node-task-input-image-store"
import { createInMemoryTaskNotificationBus } from "../../modules/task/infrastructure/notification/in-memory-task-notification-bus"
import { PrismaTaskRepository } from "../../modules/task/infrastructure/persistence/prisma-task-repository"
import { PrismaTaskEventProjection } from "../../modules/task/infrastructure/projection/prisma-task-event-projection"
import { createTaskExecutionLifecycle } from "../../modules/task/infrastructure/runtime/task-execution-lifecycle"
import { registerTaskModuleRoutes } from "../../modules/task/routes"
import {
  PrismaUserDirectory,
  registerUserModuleRoutes,
} from "../../modules/user"
import {
  PrismaWorkspaceInvitationRepository,
  PrismaWorkspaceRepository,
  registerWorkspaceModuleRoutes,
} from "../../modules/workspace"
import { createProjectGitInteractionLifecycle } from "./create-project-git-interaction-lifecycle"
import { createTaskInteractionService } from "./create-task-interaction-service"
import { createProjectTaskPort } from "./create-project-task-port"

function resolveHarborApiBaseUrl(config: ServiceConfig) {
  const normalizedHost =
    config.host === "0.0.0.0" || config.host === "::"
      ? "127.0.0.1"
      : config.host
  return `http://${normalizedHost}:${config.port}/v1`
}

function getRequiredPrismaClient(app: FastifyInstance): PrismaClient {
  const prisma = (app as FastifyInstance & { prisma?: PrismaClient }).prisma

  if (!prisma) {
    throw new Error("registerV1Routes requires app.prisma to be registered")
  }

  return prisma
}

export async function registerV1Routes(
  app: FastifyInstance,
  config: ServiceConfig,
) {
  const prisma = getRequiredPrismaClient(app)
  const projectRepository = new PrismaProjectRepository(prisma)
  const workspaceRepository = new PrismaWorkspaceRepository(prisma)
  const workspaceInvitationRepository = new PrismaWorkspaceInvitationRepository(
    prisma,
  )
  const workspaceUserDirectory = new PrismaUserDirectory(prisma)
  const orchestrationRepository = new PrismaOrchestrationRepository(prisma)
  const orchestrationBootstrapStore = new PrismaOrchestrationBootstrapStore(
    prisma,
  )
  const taskRepository = new PrismaTaskRepository(prisma)
  const taskEventProjection = new PrismaTaskEventProjection(prisma)
  const githubInstallationRepository = new PrismaGitHubInstallationRepository(
    prisma,
  )
  const workspaceInstallationRepository =
    new PrismaWorkspaceInstallationRepository(prisma)
  const projectRepositoryBindingRepository =
    new PrismaProjectRepositoryBindingRepository(prisma)
  const backgroundJobRepository = new PrismaBackgroundJobRepository(prisma)
  const authSessionStore = new PrismaAuthSessionStore(prisma)
  const agentTokenStore = new PrismaAgentTokenStore(prisma)
  const taskNotificationBus = createInMemoryTaskNotificationBus()
  const projectTaskPort = createProjectTaskPort({
    projectRepository,
    workspaceRepository,
  })
  const sandboxServices = createConfiguredSandboxServices({
    prisma,
    sandboxRootDirectory: config.sandboxRootDirectory,
    logger: app.log,
  })
  const authorizationService = createDefaultAuthorizationService({
    workspaceQuery:
      createRepositoryAuthorizationWorkspaceQuery(workspaceRepository),
    projectQuery: createRepositoryAuthorizationProjectQuery(projectRepository),
    taskQuery: createRepositoryAuthorizationTaskQuery(taskRepository),
    orchestrationQuery: createRepositoryAuthorizationOrchestrationQuery(
      orchestrationRepository,
    ),
  })
  const taskInputFileStore = createNodeTaskInputFileStore()
  const taskRuntimePort = createCurrentTaskRuntimePort({
    prisma,
    taskRepository,
    projectRepository,
    notificationPublisher: taskNotificationBus.publisher,
    harborApiBaseUrl: resolveHarborApiBaseUrl(config),
    sandbox:
      sandboxServices.provider && sandboxServices.registry
        ? {
            provider: sandboxServices.provider,
            registry: sandboxServices.registry,
          }
        : undefined,
    publicSkillsRootDirectory: config.publicSkillsRootDirectory,
    agentTokenStore,
    logger: app.log,
  })
  try {
    await createTaskExecutionLifecycle({
      prisma,
      taskRepository,
      notificationPublisher: taskNotificationBus.publisher,
      logger: app.log,
    }).reconcileOrphanedExecutions()
  } catch (error) {
    app.log.error(
      {
        error,
      },
      "Failed to reconcile orphaned task executions during service startup",
    )
  }

  const taskInteractionService = createTaskInteractionService({
    repository: taskRepository,
    eventProjection: taskEventProjection,
    notificationSubscriber: taskNotificationBus.subscriber,
  })
  const orchestrationScheduler = createOrchestrationScheduler({
    repository: orchestrationRepository,
    taskRepository,
    projectTaskPort,
    runtimePort: taskRuntimePort,
    notificationPublisher: taskNotificationBus.publisher,
    logger: app.log,
  })
  const projectPathPolicy = createNodeProjectPathPolicy()
  const gitPathWatcher = createNodeGitPathWatcher()
  const projectGitLifecycle = createProjectGitInteractionLifecycle({
    projectRepository,
    gitPathWatcher,
  })
  const backgroundJobWorker =
    sandboxServices.provider && sandboxServices.registry
      ? createBackgroundJobWorker({
          repository: backgroundJobRepository,
          handlers: {
            project_sandbox_template_bootstrap: async (job) =>
              runProjectSandboxTemplateBootstrapJobUseCase(
                {
                  projectRepository,
                  provider: sandboxServices.provider!,
                  registry: sandboxServices.registry!,
                  logger: app.log,
                },
                job,
              ),
          },
          logger: app.log,
        })
      : null
  const gitRepository = createGitCommandRepository()
  const githubAppClient = new NodeGitHubAppClient({
    appSlug: config.githubAppSlug,
    appId: config.githubAppId,
    privateKey: config.githubAppPrivateKey,
  })
  const projectLocalPathManager = createNodeProjectLocalPathManager()
  const fileSystemRepository = createNodeFileSystemRepository()
  const bootstrapRoots = [
    {
      id: "default",
      label: "Local Files",
      path: config.fileBrowserRootDirectory,
      isDefault: true,
    },
  ]

  await app.register(authSessionPlugin, {
    config,
  })

  orchestrationScheduler.start()
  app.log.info("Orchestration scheduler started")
  backgroundJobWorker?.start()
  if (backgroundJobWorker) {
    app.log.info("Background job worker started")
  }
  app.addHook("onClose", async () => {
    await orchestrationScheduler.stop()
    await backgroundJobWorker?.stop()
  })

  await registerAuthModuleRoutes(app, {
    config,
  })
  await app.register(async (protectedApp) => {
    protectedApp.addHook("preHandler", requireAuthenticatedPreHandler)

    await registerUserModuleRoutes(protectedApp, {
      userDirectory: workspaceUserDirectory,
    })
    await registerAgentTokenRoutes(protectedApp, {
      authorization: authorizationService,
      agentTokenStore,
      projectQuery:
        createRepositoryAuthorizationProjectQuery(projectRepository),
      orchestrationQuery: createRepositoryAuthorizationOrchestrationQuery(
        orchestrationRepository,
      ),
      taskQuery: createRepositoryAuthorizationTaskQuery(taskRepository),
    })
    await registerAgentRoutes(protectedApp)
    if (sandboxServices.provider && sandboxServices.registry) {
      await registerSandboxModuleRoutes(protectedApp, {
        authorization: authorizationService,
        projectRepository,
        provider: sandboxServices.provider,
        registry: sandboxServices.registry,
      })
    }
    await registerGitHubIntegrationRoutes(protectedApp, {
      config,
      githubAppSlug: config.githubAppSlug,
      workspaceRepository,
      workspaceInstallationRepository,
      installationRepository: githubInstallationRepository,
      githubAppClient,
    })
    await registerWorkspaceModuleRoutes(protectedApp, {
      repository: workspaceRepository,
      invitationRepository: workspaceInvitationRepository,
      userDirectory: workspaceUserDirectory,
    })
    await registerProjectModuleRoutes(protectedApp, {
      authorization: authorizationService,
      repository: projectRepository,
      onProjectCreated: backgroundJobWorker
        ? async (project) => {
            await enqueueProjectSandboxTemplateBootstrapJobUseCase(
              {
                repository: backgroundJobRepository,
              },
              {
                projectId: project.id,
              },
            )
          }
        : undefined,
      workspaceRepository,
      workspaceInstallationRepository,
      pathPolicy: projectPathPolicy,
      installationRepository: githubInstallationRepository,
      repositoryBindingRepository: projectRepositoryBindingRepository,
      githubAppClient,
      localPathManager: projectLocalPathManager,
      projectLocalPathRootDirectory: config.projectLocalPathRootDirectory,
    })
    await registerOrchestrationModuleRoutes(protectedApp, {
      authorization: authorizationService,
      repository: orchestrationRepository,
      bootstrapStore: orchestrationBootstrapStore,
      projectRepository,
      workspaceRepository,
      projectTaskPort,
      taskRepository,
      runtimePort: taskRuntimePort,
      notificationPublisher: taskNotificationBus.publisher,
    })
    await registerGitModuleRoutes(protectedApp, {
      authorization: authorizationService,
      projectRepository,
      workspaceRepository,
      gitRepository,
    })
    await registerFileSystemModuleRoutes(protectedApp, {
      authorization: authorizationService,
      projectRepository,
      workspaceRepository,
      fileSystemRepository,
      bootstrapRoots,
    })
    await registerTaskModuleRoutes(protectedApp, {
      authorization: authorizationService,
      repository: taskRepository,
      taskRecordStore: taskRepository,
      eventProjection: taskEventProjection,
      notificationPublisher: taskNotificationBus.publisher,
      projectRepository,
      workspaceRepository,
      projectTaskPort,
      taskInputFileStore,
      runtimePort: taskRuntimePort,
    })
  })
  createInteractionSocketGateway({
    authorization: authorizationService,
    taskQueries: taskInteractionService.queries,
    taskStream: taskInteractionService.stream,
    projectGitWatcher: projectGitLifecycle,
    app,
    async resolveSocketActor(socket) {
      const token = fastifyCookie.parse(socket.request.headers.cookie ?? "")[
        HARBOR_SESSION_COOKIE_NAME
      ]

      if (!token) {
        return null
      }

      const auth = await authSessionStore.getSessionByToken(token)
      if (!auth) {
        return null
      }

      if (auth.kind === "agent") {
        return null
      }

      await authSessionStore.touchSession(auth.sessionId)

      return {
        kind: "user",
        userId: auth.userId,
      }
    },
  })
}
