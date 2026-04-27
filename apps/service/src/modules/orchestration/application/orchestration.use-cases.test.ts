import { describe, expect, it, vi } from "vitest"

import { createTask } from "../../task/domain/task"
import { attachTaskRuntime } from "../../task/application/task-read-models"
import { InMemoryTaskRepository } from "../../task/infrastructure/in-memory-task-repository"
import { InMemoryOrchestrationRepository } from "../infrastructure/in-memory-orchestration-repository"
import { bootstrapOrchestrationUseCase } from "./bootstrap-orchestration"
import { runDueOrchestrationSchedulesUseCase } from "./run-due-orchestration-schedules"
import { createOrchestration } from "../domain/orchestration"
import { createOrchestrationTaskUseCase } from "./create-orchestration-task"
import { createOrchestrationUseCase } from "./create-orchestration"
import { getOrchestrationUseCase } from "./get-orchestration"
import { listOrchestrationTasksUseCase } from "./list-orchestration-tasks"
import { listProjectOrchestrationsUseCase } from "./list-project-orchestrations"
import type { CreateBootstrapRecordInput } from "./orchestration-bootstrap-store"
import { resolveNextCronOccurrence } from "./orchestration-cron"
import { upsertOrchestrationScheduleUseCase } from "./upsert-orchestration-schedule"

describe("orchestration use cases", () => {
  function createProject(projectId = "project-1") {
    return {
      id: projectId,
      ownerUserId: null,
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
        codex: {
          baseUrl: null,
          apiKey: null,
        },
      },
    }
  }

  function createGitProjectWithoutWorkspace(projectId = "project-1") {
    return {
      ...createProject(projectId),
      source: {
        type: "git" as const,
        repositoryUrl: "https://github.com/acme/harbor-assistant.git",
        branch: "main",
      },
      rootPath: null,
      normalizedPath: null,
    }
  }

  it("lists project orchestrations without task summaries", async () => {
    const repository = new InMemoryOrchestrationRepository([
      createOrchestration({
        id: "orch-1",
        projectId: "project-1",
        title: "Runtime cleanup",
      }),
    ])
    const projectRepository = {
      findById: vi.fn(async (id: string) =>
        id === "project-1" ? createProject("project-1") : null,
      ),
    }
    const orchestrations = await listProjectOrchestrationsUseCase(
      {
        repository,
        projectRepository,
      },
      {
        projectId: "project-1",
      },
    )

    expect(orchestrations).toEqual([
      expect.objectContaining({
        id: "orch-1",
        projectId: "project-1",
      }),
    ])
  })

  it("creates an orchestration task through the task use case", async () => {
    const repository = new InMemoryOrchestrationRepository([
      createOrchestration({
        id: "orch-1",
        projectId: "project-1",
        title: "Runtime cleanup",
      }),
    ])
    const taskRepository = new InMemoryTaskRepository()
    const projectTaskPort = {
      getProjectForTask: vi.fn(async (projectId: string) => ({
        projectId,
        rootPath: "/tmp/harbor-assistant",
        codex: {
          baseUrl: null,
          apiKey: null,
        },
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

    const task = await createOrchestrationTaskUseCase(
      {
        repository,
        projectTaskPort,
        taskRepository,
        runtimePort,
        notificationPublisher,
      },
      {
        orchestrationId: "orch-1",
        prompt: "Investigate runtime drift",
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "safe",
        effort: "medium",
      },
    )

    expect(projectTaskPort.getProjectForTask).toHaveBeenCalledWith("project-1")
    expect(runtimePort.startTaskExecution).toHaveBeenCalledTimes(1)
    expect(task.orchestrationId).toBe("orch-1")
  })

  it("stores orchestration schedule with next trigger", async () => {
    const repository = new InMemoryOrchestrationRepository([
      createOrchestration({
        id: "orch-1",
        projectId: "project-1",
        title: "Runtime cleanup",
      }),
    ])
    const orchestration = await upsertOrchestrationScheduleUseCase(
      {
        repository,
        now: () => new Date("2026-04-17T10:05:30.000Z"),
      },
      {
        orchestrationId: "orch-1",
        enabled: true,
        cronExpression: "*/15 * * * *",
        timezone: "UTC",
        taskTemplate: {
          prompt: "Run scheduled runtime cleanup",
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "safe",
          effort: "medium",
        },
      },
    )

    expect(orchestration.schedule).toMatchObject({
      enabled: true,
      cronExpression: "*/15 * * * *",
      timezone: "UTC",
      nextTriggerAt: new Date("2026-04-17T10:15:00.000Z"),
    })
  })

  it("triggers due orchestration schedules and advances next trigger", async () => {
    const repository = new InMemoryOrchestrationRepository([
      createOrchestration({
        id: "orch-1",
        projectId: "project-1",
        title: "Runtime cleanup",
      }),
    ])
    const taskRepository = new InMemoryTaskRepository()
    const projectTaskPort = {
      getProjectForTask: vi.fn(async (projectId: string) => ({
        projectId,
        rootPath: "/tmp/harbor-assistant",
        codex: {
          baseUrl: null,
          apiKey: null,
        },
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
    const now = new Date("2026-04-17T10:05:00.000Z")

    await upsertOrchestrationScheduleUseCase(
      {
        repository,
        now: () => new Date("2026-04-17T09:50:00.000Z"),
      },
      {
        orchestrationId: "orch-1",
        enabled: true,
        cronExpression: "0 * * * *",
        timezone: "UTC",
        taskTemplate: {
          prompt: "Run scheduled runtime cleanup",
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "safe",
          effort: "medium",
        },
      },
    )

    await runDueOrchestrationSchedulesUseCase({
      repository,
      taskRepository,
      projectTaskPort,
      runtimePort,
      notificationPublisher,
      logger: {
        info: vi.fn(),
        error: vi.fn(),
      } as never,
      now: () => now,
    })

    const tasks = await taskRepository.listByOrchestration({
      orchestrationId: "orch-1",
    })
    const orchestration = await repository.findById("orch-1")

    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({
      orchestrationId: "orch-1",
      prompt: "Run scheduled runtime cleanup",
    })
    expect(orchestration?.schedule).toMatchObject({
      lastTriggeredAt: now,
      nextTriggerAt: new Date("2026-04-17T11:00:00.000Z"),
    })
  })

  it("bootstraps an orchestration and first task together", async () => {
    const repository = new InMemoryOrchestrationRepository()
    const taskRepository = new InMemoryTaskRepository()
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
    const projectRepository = {
      findById: vi.fn(async (id: string) =>
        id === "project-1" ? createProject("project-1") : null,
      ),
    }
    const runtimePort = {
      startTaskExecution: vi.fn(async () => {}),
      resumeTaskExecution: vi.fn(async () => {}),
      cancelTaskExecution: vi.fn(async () => {}),
    }
    const notificationPublisher = {
      publish: vi.fn(async () => {}),
    }

    const result = await bootstrapOrchestrationUseCase(
      {
        bootstrapStore,
        projectRepository,
        taskRepository,
        runtimePort,
        notificationPublisher,
        orchestrationIdGenerator: () => "orch-bootstrap-1",
        taskIdGenerator: () => "task-bootstrap-1",
      },
      {
        projectId: "project-1",
        orchestration: {
          title: "Runtime cleanup",
          description: "Coordinate follow-up work",
        },
        initialTask: {
          prompt: "Investigate runtime drift",
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "safe",
          effort: "medium",
        },
      },
    )

    expect(bootstrapStore.create).toHaveBeenCalledTimes(1)
    expect(runtimePort.startTaskExecution).toHaveBeenCalledTimes(1)
    expect(result.orchestration).toMatchObject({
      id: "orch-bootstrap-1",
      projectId: "project-1",
      title: "Runtime cleanup",
      description: "Coordinate follow-up work",
    })
    expect(result.task).toMatchObject({
      id: "task-bootstrap-1",
      orchestrationId: "orch-bootstrap-1",
      projectId: "project-1",
      prompt: "Investigate runtime drift",
      status: "queued",
    })
    expect(result.bootstrap).toEqual({
      runtimeStarted: true,
      warning: null,
    })
  })

  it("derives the orchestration title from the opening prompt when omitted", async () => {
    const repository = new InMemoryOrchestrationRepository()
    const taskRepository = new InMemoryTaskRepository()
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
    const projectRepository = {
      findById: vi.fn(async (id: string) =>
        id === "project-1" ? createProject("project-1") : null,
      ),
    }
    const runtimePort = {
      startTaskExecution: vi.fn(async () => {}),
      resumeTaskExecution: vi.fn(async () => {}),
      cancelTaskExecution: vi.fn(async () => {}),
    }
    const notificationPublisher = {
      publish: vi.fn(async () => {}),
    }

    const result = await bootstrapOrchestrationUseCase(
      {
        bootstrapStore,
        projectRepository,
        taskRepository,
        runtimePort,
        notificationPublisher,
      },
      {
        projectId: "project-1",
        initialTask: {
          prompt:
            "Investigate runtime drift across the worker pool and summarize the highest-risk failures.",
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "safe",
          effort: "medium",
        },
      },
    )

    expect(result.orchestration.title).toBe(
      "Investigate runtime drift across the worker pool and summarize the highest-risk failures.",
    )
  })

  it("returns a failed task warning when bootstrap runtime start fails", async () => {
    const repository = new InMemoryOrchestrationRepository()
    const taskRepository = new InMemoryTaskRepository()
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
    const projectRepository = {
      findById: vi.fn(async (id: string) =>
        id === "project-1" ? createProject("project-1") : null,
      ),
    }
    const runtimePort = {
      startTaskExecution: vi.fn(async () => {
        throw new Error("runtime unavailable")
      }),
      resumeTaskExecution: vi.fn(async () => {}),
      cancelTaskExecution: vi.fn(async () => {}),
    }
    const notificationPublisher = {
      publish: vi.fn(async () => {}),
    }

    const result = await bootstrapOrchestrationUseCase(
      {
        bootstrapStore,
        projectRepository,
        taskRepository,
        runtimePort,
        notificationPublisher,
        orchestrationIdGenerator: () => "orch-bootstrap-2",
        taskIdGenerator: () => "task-bootstrap-2",
      },
      {
        projectId: "project-1",
        orchestration: {
          title: "Runtime cleanup",
        },
        initialTask: {
          prompt: "Investigate runtime drift",
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "safe",
          effort: "medium",
        },
      },
    )

    expect(result.task.status).toBe("failed")
    expect(result.bootstrap).toEqual({
      runtimeStarted: false,
      warning: {
        code: "START_FAILED",
        message: "runtime unavailable",
      },
    })
    expect(notificationPublisher.publish).toHaveBeenCalledTimes(2)
  })

  it("resolves next cron occurrence in timezone-aware manner", () => {
    const next = resolveNextCronOccurrence({
      cronExpression: "0 9 * * mon-fri",
      timezone: "Asia/Shanghai",
      after: new Date("2026-04-17T01:10:00.000Z"),
    })

    expect(next.toISOString()).toBe("2026-04-20T01:00:00.000Z")
  })

  it("rejects creating tasks for archived orchestrations", async () => {
    const repository = new InMemoryOrchestrationRepository([
      createOrchestration({
        id: "orch-archived",
        projectId: "project-1",
        title: "Runtime cleanup",
        status: "archived",
        archivedAt: new Date("2026-04-01T00:00:00.000Z"),
      }),
    ])
    const taskRepository = new InMemoryTaskRepository()
    const projectTaskPort = {
      getProjectForTask: vi.fn(),
    }
    const runtimePort = {
      startTaskExecution: vi.fn(async () => {}),
      resumeTaskExecution: vi.fn(async () => {}),
      cancelTaskExecution: vi.fn(async () => {}),
    }
    const notificationPublisher = {
      publish: vi.fn(async () => {}),
    }

    await expect(
      createOrchestrationTaskUseCase(
        {
          repository,
          projectTaskPort,
          taskRepository,
          runtimePort,
          notificationPublisher,
        },
        {
          orchestrationId: "orch-archived",
          prompt: "Investigate runtime drift",
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "safe",
          effort: "medium",
        },
      ),
    ).rejects.toThrow("archived orchestrations cannot accept new tasks")
    expect(projectTaskPort.getProjectForTask).not.toHaveBeenCalled()
    expect(runtimePort.startTaskExecution).not.toHaveBeenCalled()
  })

  it("returns orchestration detail and task list from delegated dependencies", async () => {
    const repository = new InMemoryOrchestrationRepository([
      createOrchestration({
        id: "orch-1",
        projectId: "project-1",
        title: "Runtime cleanup",
      }),
    ])
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
    const detail = await getOrchestrationUseCase(
      {
        repository,
      },
      "orch-1",
    )
    const tasks = await listOrchestrationTasksUseCase(
      {
        repository,
        taskRepository,
      },
      {
        orchestrationId: "orch-1",
      },
    )

    expect(detail).toMatchObject({
      id: "orch-1",
    })
    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.orchestrationId).toBe("orch-1")
  })

  it("creates a new orchestration for an existing project", async () => {
    const repository = new InMemoryOrchestrationRepository()
    const projectRepository = {
      findById: vi.fn(async (id: string) =>
        id === "project-1" ? createProject("project-1") : null,
      ),
    }

    const orchestration = await createOrchestrationUseCase(
      {
        repository,
        projectRepository,
        idGenerator: () => "orch-created-1",
      },
      {
        projectId: "project-1",
        title: "Refactor runtime boundaries",
      },
    )

    expect(orchestration).toMatchObject({
      id: "orch-created-1",
      projectId: "project-1",
      title: "Refactor runtime boundaries",
    })
  })

  it("rejects creating an orchestration for a project that is not ready", async () => {
    const repository = new InMemoryOrchestrationRepository()
    const projectRepository = {
      findById: vi.fn(async (id: string) =>
        id === "project-1"
          ? createGitProjectWithoutWorkspace("project-1")
          : null,
      ),
    }

    await expect(
      createOrchestrationUseCase(
        {
          repository,
          projectRepository,
          idGenerator: () => "orch-created-1",
        },
        {
          projectId: "project-1",
          title: "Refactor runtime boundaries",
        },
      ),
    ).rejects.toThrow("project is not ready for workflows")
  })

  it("rejects bootstrap for a project that is not ready", async () => {
    const repository = new InMemoryOrchestrationRepository()
    const taskRepository = new InMemoryTaskRepository()
    const bootstrapStore = {
      create: vi.fn(),
    }
    const projectRepository = {
      findById: vi.fn(async (id: string) =>
        id === "project-1"
          ? createGitProjectWithoutWorkspace("project-1")
          : null,
      ),
    }
    const runtimePort = {
      startTaskExecution: vi.fn(async () => {}),
      resumeTaskExecution: vi.fn(async () => {}),
      cancelTaskExecution: vi.fn(async () => {}),
    }
    const notificationPublisher = {
      publish: vi.fn(async () => {}),
    }

    await expect(
      bootstrapOrchestrationUseCase(
        {
          bootstrapStore,
          projectRepository,
          taskRepository,
          runtimePort,
          notificationPublisher,
          orchestrationIdGenerator: () => "orch-bootstrap-3",
          taskIdGenerator: () => "task-bootstrap-3",
        },
        {
          projectId: "project-1",
          orchestration: {
            title: "Runtime cleanup",
          },
          initialTask: {
            prompt: "Investigate runtime drift",
            executor: "codex",
            model: "gpt-5.3-codex",
            executionMode: "safe",
            effort: "medium",
          },
        },
      ),
    ).rejects.toThrow("project is not ready for workflows")
  })
})
