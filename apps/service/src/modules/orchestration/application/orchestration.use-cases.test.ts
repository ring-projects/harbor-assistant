import { describe, expect, it, vi } from "vitest"

import { createTask } from "../../task/domain/task"
import { attachTaskRuntime } from "../../task/application/task-read-models"
import { InMemoryTaskRepository } from "../../task/infrastructure/in-memory-task-repository"
import { InMemoryOrchestrationRepository } from "../infrastructure/in-memory-orchestration-repository"
import { createOrchestration } from "../domain/orchestration"
import { createOrchestrationTaskUseCase } from "./create-orchestration-task"
import { createOrchestrationUseCase } from "./create-orchestration"
import { getOrchestrationUseCase } from "./get-orchestration"
import { listOrchestrationTasksUseCase } from "./list-orchestration-tasks"
import { listProjectOrchestrationsUseCase } from "./list-project-orchestrations"

describe("orchestration use cases", () => {
  function createProject(projectId = "project-1") {
    return {
      id: projectId,
      slug: "harbor-assistant",
      name: "Harbor Assistant",
      description: null,
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
      "project-1",
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
})
