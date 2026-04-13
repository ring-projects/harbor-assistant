import Fastify from "fastify"

import {
  createDefaultAuthorizationService,
  createRepositoryAuthorizationOrchestrationQuery,
  createRepositoryAuthorizationProjectQuery,
  createRepositoryAuthorizationTaskQuery,
  createRepositoryAuthorizationWorkspaceQuery,
} from "../../src/modules/authorization"
import { createNodeFileSystemRepository } from "../../src/modules/filesystem/infrastructure/node-filesystem-repository"
import { registerFileSystemModuleRoutes } from "../../src/modules/filesystem/routes"
import { InMemoryOrchestrationRepository } from "../../src/modules/orchestration/infrastructure/in-memory-orchestration-repository"
import { InMemoryProjectRepository } from "../../src/modules/project/infrastructure/in-memory-project-repository"
import { InMemoryTaskRepository } from "../../src/modules/task/infrastructure/in-memory-task-repository"
import { InMemoryWorkspaceRepository } from "../../src/modules/workspace/infrastructure/in-memory-workspace-repository"
import errorHandlerPlugin from "../../src/plugins/error-handler"

export async function createFileSystemTestApp() {
  const app = Fastify({
    logger: false,
  })
  const projectRepository = new InMemoryProjectRepository()
  const workspaceRepository = new InMemoryWorkspaceRepository()
  const authorization = createDefaultAuthorizationService({
    workspaceQuery: createRepositoryAuthorizationWorkspaceQuery(
      workspaceRepository,
    ),
    projectQuery: createRepositoryAuthorizationProjectQuery(projectRepository),
    taskQuery: createRepositoryAuthorizationTaskQuery(new InMemoryTaskRepository()),
    orchestrationQuery: createRepositoryAuthorizationOrchestrationQuery(
      new InMemoryOrchestrationRepository(),
    ),
  })

  app.decorateRequest("auth", null)
  app.addHook("onRequest", async (request) => {
    request.auth = {
      sessionId: "session-test",
      userId: "user-1",
      user: {
        id: "user-1",
        githubLogin: "user-1",
        name: "User One",
        email: "user-1@example.com",
        avatarUrl: null,
        status: "active",
        lastLoginAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
      },
    }
  })
  await app.register(errorHandlerPlugin)
  await app.register(
    async (instance) => {
      await registerFileSystemModuleRoutes(instance, {
        authorization,
        projectRepository,
        workspaceRepository,
        fileSystemRepository: createNodeFileSystemRepository(),
      })
    },
    {
      prefix: "/v1",
    },
  )

  await app.ready()
  return app
}
