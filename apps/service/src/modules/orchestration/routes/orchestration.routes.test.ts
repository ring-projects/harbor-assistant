import Fastify from "fastify"
import { describe, expect, it, vi } from "vitest"

import {
  createDefaultAuthorizationService,
  createRepositoryAuthorizationOrchestrationQuery,
  createRepositoryAuthorizationProjectQuery,
  createRepositoryAuthorizationTaskQuery,
  createRepositoryAuthorizationWorkspaceQuery,
} from "../../authorization"
import errorHandlerPlugin from "../../../plugins/error-handler"
import { createTask } from "../../task/domain/task"
import { attachTaskRuntime } from "../../task/application/task-read-models"
import { InMemoryTaskRepository } from "../../task/infrastructure/in-memory-task-repository"
import { createWorkspace } from "../../workspace/domain/workspace"
import { InMemoryWorkspaceRepository } from "../../workspace/infrastructure/in-memory-workspace-repository"
import { InMemoryOrchestrationRepository } from "../infrastructure/in-memory-orchestration-repository"
import { createOrchestration } from "../domain/orchestration"
import type { CreateBootstrapRecordInput } from "../application/orchestration-bootstrap-store"
import { registerOrchestrationModuleRoutes } from "."

async function createApp(args?: {
  workspaceRepository?: InMemoryWorkspaceRepository
  workspaceId?: string | null
  ownerUserId?: string | null
}) {
  const repository = new InMemoryOrchestrationRepository([
    createOrchestration({
      id: "orch-1",
      projectId: "project-1",
      title: "Runtime cleanup",
    }),
  ])
  const workspaceRepository =
    args?.workspaceRepository ?? new InMemoryWorkspaceRepository()
  const projectRepository = {
    findById: vi.fn(async (id: string) =>
          id === "project-1"
        ? {
            id: "project-1",
            ownerUserId: args?.ownerUserId ?? null,
            workspaceId: args?.workspaceId ?? null,
            slug: "harbor-assistant",
            name: "Harbor Assistant",
            description: null,
            source: {
              type: "rootPath" as const,
              rootPath: "/tmp/harbor-assistant",
              normalizedPath: "/tmp/harbor-assistant",
            },
            rootPath: "/tmp/harbor-assistant",
            normalizedPath: "/tmp/harbor-assistant",
            status: "active" as const,
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
            updatedAt: new Date("2026-04-01T00:00:00.000Z"),
            archivedAt: null,
            lastOpenedAt: null,
            settings: {
              retention: {
                logRetentionDays: 30,
                eventRetentionDays: 7,
              },
              skills: {
                harborSkillsEnabled: false,
                harborSkillProfile: "default",
              },
            },
          }
        : null,
    ),
  }
  const task = attachTaskRuntime(
    createTask({
      id: "task-1",
      projectId: "project-1",
      orchestrationId: "orch-1",
      prompt: "Investigate runtime drift",
      status: "running",
    }),
    {
      executor: "codex",
      model: "gpt-5.3-codex",
      executionMode: "safe",
      effort: "medium",
    },
  )
  const taskRepository = new InMemoryTaskRepository([task])
  const authorization = createDefaultAuthorizationService({
    workspaceQuery: createRepositoryAuthorizationWorkspaceQuery(
      workspaceRepository,
    ),
    projectQuery: createRepositoryAuthorizationProjectQuery(projectRepository),
    taskQuery: createRepositoryAuthorizationTaskQuery(taskRepository),
    orchestrationQuery: createRepositoryAuthorizationOrchestrationQuery(repository),
  })
  const bootstrapStore = {
    create: vi.fn(
      async ({
        orchestration,
        task,
        projectPath,
        runtimeConfig,
      }: CreateBootstrapRecordInput) => {
        await repository.save(orchestration)
        await taskRepository.create({
          task,
          projectPath,
          runtimeConfig,
        })
      },
    ),
  }
  const projectTaskPort = {
    getProjectForTask: vi.fn(async (projectId: string) => ({
      projectId,
      rootPath: "/tmp/harbor-assistant",
    })),
  }
  const runtimePort = {
    startTaskExecution: vi.fn(async () => {}),
    resumeTaskExecution: vi.fn(async () => {}),
    cancelTaskExecution: vi.fn(async () => {}),
  }
  const notificationPublisher = {
    publish: vi.fn(async () => {}),
  }
  const app = Fastify({ logger: false })
  app.decorateRequest("auth", null)
  app.addHook("onRequest", async (request) => {
    const userId = String(request.headers["x-user-id"] ?? "user-1")
    const githubLogin = String(request.headers["x-user-login"] ?? userId)
    request.auth = {
      sessionId: "session-1",
      userId,
      user: {
        id: userId,
        githubLogin,
        name: "User One",
        email: `${githubLogin}@example.com`,
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
      await registerOrchestrationModuleRoutes(instance, {
        authorization,
        repository,
        bootstrapStore,
        projectRepository,
        projectTaskPort,
        taskRepository,
        runtimePort,
        notificationPublisher,
      })
    },
    { prefix: "/v1" },
  )
  await app.ready()
  return app
}

describe("orchestration routes", () => {
  it("exposes orchestration creation, listing, detail, and task endpoints", async () => {
    const app = await createApp()

    const created = await app.inject({
      method: "POST",
      url: "/v1/orchestrations",
      payload: {
        projectId: "project-1",
        title: "Refactor runtime boundaries",
      },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({
      ok: true,
      orchestration: {
        projectId: "project-1",
        title: "Refactor runtime boundaries",
      },
    })

    const bootstrapped = await app.inject({
      method: "POST",
      url: "/v1/orchestrations/bootstrap",
      payload: {
        projectId: "project-1",
        orchestration: {
          title: "Bootstrap orchestration",
          description: "Create initial task together",
        },
        initialTask: {
          prompt: "Investigate runtime drift",
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "safe",
          effort: "medium",
        },
      },
    })
    expect(bootstrapped.statusCode).toBe(201)
    expect(bootstrapped.json()).toMatchObject({
      ok: true,
      orchestration: {
        projectId: "project-1",
        title: "Bootstrap orchestration",
      },
      task: {
        projectId: "project-1",
        prompt: "Investigate runtime drift",
      },
      bootstrap: {
        runtimeStarted: true,
        warning: null,
      },
    })

    const listed = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/orchestrations",
    })
    expect(listed.statusCode).toBe(200)
    expect(listed.json().ok).toBe(true)
    expect(listed.json().orchestrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "orch-1",
        }),
        expect.objectContaining({
          title: "Refactor runtime boundaries",
        }),
      ]),
    )

    const detail = await app.inject({
      method: "GET",
      url: "/v1/orchestrations/orch-1",
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json()).toMatchObject({
      ok: true,
      orchestration: {
        id: "orch-1",
      },
    })

    const createdTask = await app.inject({
      method: "POST",
      url: "/v1/orchestrations/orch-1/tasks",
      payload: {
        prompt: "Investigate runtime drift",
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "safe",
        effort: "medium",
      },
    })
    expect(createdTask.statusCode).toBe(201)
    expect(createdTask.json()).toMatchObject({
      ok: true,
      task: {
        orchestrationId: "orch-1",
        projectId: "project-1",
      },
    })

    const listedTasks = await app.inject({
      method: "GET",
      url: "/v1/orchestrations/orch-1/tasks",
    })
    expect(listedTasks.statusCode).toBe(200)
    expect(listedTasks.json()).toMatchObject({
      ok: true,
      tasks: expect.arrayContaining([
        expect.objectContaining({
          id: "task-1",
          orchestrationId: "orch-1",
        }),
      ]),
    })

    await app.close()
  })

  it("rejects orchestration creation when the project is not ready", async () => {
    const repository = new InMemoryOrchestrationRepository()
    const projectRepository = {
      findById: vi.fn(async () => ({
        id: "project-1",
        ownerUserId: null,
        slug: "harbor-assistant",
        name: "Harbor Assistant",
        description: null,
        source: {
          type: "git" as const,
          repositoryUrl: "https://github.com/acme/harbor-assistant.git",
          branch: "main",
        },
        rootPath: null,
        normalizedPath: null,
        status: "active" as const,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        archivedAt: null,
        lastOpenedAt: null,
        settings: {
          retention: {
            logRetentionDays: 30,
            eventRetentionDays: 7,
          },
          skills: {
            harborSkillsEnabled: false,
            harborSkillProfile: "default",
          },
        },
      })),
    }
    const app = Fastify({ logger: false })
    app.decorateRequest("auth", null)
    app.addHook("onRequest", async (request) => {
      request.auth = {
        sessionId: "session-1",
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
        const authorization = createDefaultAuthorizationService({
          workspaceQuery: createRepositoryAuthorizationWorkspaceQuery({
            findById: async () => null,
          }),
          projectQuery: createRepositoryAuthorizationProjectQuery(projectRepository),
          taskQuery: createRepositoryAuthorizationTaskQuery(
            new InMemoryTaskRepository(),
          ),
          orchestrationQuery: createRepositoryAuthorizationOrchestrationQuery(
            repository,
          ),
        })
        await registerOrchestrationModuleRoutes(instance, {
          authorization,
          repository,
          bootstrapStore: {
            create: vi.fn(),
          },
          projectRepository,
          projectTaskPort: {
            getProjectForTask: vi.fn(),
          },
          taskRepository: new InMemoryTaskRepository(),
          runtimePort: {
            startTaskExecution: vi.fn(async () => {}),
            resumeTaskExecution: vi.fn(async () => {}),
            cancelTaskExecution: vi.fn(async () => {}),
          },
          notificationPublisher: {
            publish: vi.fn(async () => {}),
          },
        })
      },
      { prefix: "/v1" },
    )
    await app.ready()

    const created = await app.inject({
      method: "POST",
      url: "/v1/orchestrations",
      payload: {
        projectId: "project-1",
        title: "Refactor runtime boundaries",
      },
    })

    expect(created.statusCode).toBe(409)
    expect(created.json()).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_PROJECT_STATE",
      },
    })

    await app.close()
  })

  it("allows workspace members to create and read orchestrations on shared projects", async () => {
    const workspaceRepository = new InMemoryWorkspaceRepository()
    const workspace = createWorkspace({
      id: "ws-team",
      name: "Harbor Team",
      type: "team",
      createdByUserId: "user-1",
    })
    await workspaceRepository.save({
      ...workspace,
      memberships: [
        ...workspace.memberships,
        {
          workspaceId: "ws-team",
          userId: "user-2",
          role: "member",
          status: "active",
          createdAt: new Date("2026-04-06T00:00:00.000Z"),
          updatedAt: new Date("2026-04-06T00:00:00.000Z"),
        },
      ],
    })

    const app = await createApp({
      workspaceRepository,
      workspaceId: "ws-team",
      ownerUserId: "user-1",
    })

    const created = await app.inject({
      method: "POST",
      url: "/v1/orchestrations",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
      payload: {
        projectId: "project-1",
        title: "Member orchestration",
      },
    })
    expect(created.statusCode).toBe(201)

    const listed = await app.inject({
      method: "GET",
      url: "/v1/projects/project-1/orchestrations",
      headers: {
        "x-user-id": "user-2",
        "x-user-login": "user-2",
      },
    })
    expect(listed.statusCode).toBe(200)
    expect(listed.json().orchestrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Member orchestration",
        }),
      ]),
    )

    await app.close()
  })
})
