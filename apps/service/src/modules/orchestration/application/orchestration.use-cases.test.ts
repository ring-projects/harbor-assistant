import { describe, expect, it, vi } from "vitest"

import { createTask } from "../../task/domain/task"
import { attachTaskRuntime } from "../../task/application/task-read-models"
import { InMemoryOrchestrationRepository } from "../infrastructure/in-memory-orchestration-repository"
import { createOrchestration } from "../domain/orchestration"
import { createOrchestrationTaskUseCase } from "./create-orchestration-task"
import { createOrchestrationUseCase } from "./create-orchestration"
import { getOrchestrationDetailUseCase } from "./get-orchestration-detail"
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

  it("creates and aggregates project orchestrations from task summaries", async () => {
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
    const taskRepository = {
      listByProject: vi.fn(async () => [
        attachTaskRuntime(
          createTask({
            id: "task-2",
            projectId: "project-1",
            orchestrationId: "orch-1",
            prompt: "Summarize runtime drift",
            status: "completed",
            updatedAt: new Date("2026-04-01T00:20:00.000Z"),
          }),
          {
            executor: "codex",
            model: "gpt-5.3-codex",
            executionMode: "safe",
            effort: "medium",
          },
        ),
        attachTaskRuntime(
          createTask({
            id: "task-1",
            projectId: "project-1",
            orchestrationId: "orch-1",
            prompt: "Investigate runtime drift",
            status: "running",
            updatedAt: new Date("2026-04-01T00:10:00.000Z"),
          }),
          {
            executor: "codex",
            model: "gpt-5.3-codex",
            executionMode: "safe",
            effort: "medium",
          },
        ),
      ]),
      listByOrchestration: vi.fn(async () => []),
    }

    const orchestrations = await listProjectOrchestrationsUseCase(
      {
        repository,
        projectRepository,
        taskRepository,
      },
      "project-1",
    )

    expect(orchestrations).toEqual([
      expect.objectContaining({
        id: "orch-1",
        projectId: "project-1",
        taskCount: 2,
        activeTaskCount: 1,
        latestTaskSummary: "Summarize runtime drift",
      }),
    ])
  })

  it("creates an orchestration task through the delegated task port", async () => {
    const repository = new InMemoryOrchestrationRepository([
      createOrchestration({
        id: "orch-1",
        projectId: "project-1",
        title: "Runtime cleanup",
      }),
    ])
    const taskPort = {
      createTaskForOrchestration: vi.fn(async (input) => ({
        id: "task-1",
        projectId: input.projectId,
        orchestrationId: input.orchestrationId,
        prompt: "Investigate runtime drift",
        title: "Investigate runtime drift",
        titleSource: "prompt" as const,
        executor: input.executor,
        model: input.model,
        executionMode: input.executionMode,
        effort: input.effort,
        status: "queued" as const,
        archivedAt: null,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        updatedAt: new Date("2026-04-01T00:00:00.000Z"),
        startedAt: null,
        finishedAt: null,
      })),
      listTasksForOrchestration: vi.fn(async () => []),
    }

    const task = await createOrchestrationTaskUseCase(
      {
        repository,
        taskPort,
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

    expect(taskPort.createTaskForOrchestration).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        orchestrationId: "orch-1",
      }),
    )
    expect(task.orchestrationId).toBe("orch-1")
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

    const taskRepository = {
      listByOrchestration: vi.fn(async () => [task]),
    }
    const taskPort = {
      createTaskForOrchestration: vi.fn(),
      listTasksForOrchestration: vi.fn(async () => [
        {
          ...task,
          title: task.title,
        },
      ]),
    }

    const detail = await getOrchestrationDetailUseCase(
      {
        repository,
        taskRepository,
      },
      "orch-1",
    )
    const tasks = await listOrchestrationTasksUseCase(
      {
        repository,
        taskPort,
      },
      {
        orchestrationId: "orch-1",
      },
    )

    expect(detail).toMatchObject({
      id: "orch-1",
      taskCount: 1,
      activeTaskCount: 1,
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
      taskCount: 0,
    })
  })
})
