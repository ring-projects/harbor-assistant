import { afterEach, describe, expect, it } from "vitest"

import { createTestDatabase, type TestDatabase } from "../../../../test/helpers/test-database"
import type { AgentType, IAgentRuntime } from "../../../lib/agents"
import { createInMemoryTaskNotificationBus } from "../infrastructure/notification/in-memory-task-notification-bus"
import { PrismaTaskRepository } from "../infrastructure/persistence/prisma-task-repository"
import { createCurrentTaskRuntimePort } from "./current-task-runtime-port"

describe("Current task runtime port", () => {
  let database: TestDatabase | null = null

  afterEach(async () => {
    await database?.cleanup()
    database = null
  })

  it("fails both task and execution when startTaskExecution cannot resolve a runtime", async () => {
    database = await createTestDatabase()
    const { prisma } = database

    await prisma.project.create({
      data: {
        id: "project-1",
        name: "Project 1",
        rootPath: "/tmp/project-1",
        normalizedPath: "/tmp/project-1",
      },
    })

    await prisma.task.create({
      data: {
        id: "task-1",
        projectId: "project-1",
        prompt: "Investigate runtime failure",
        title: "Investigate runtime failure",
        status: "queued",
      },
    })

    await prisma.execution.create({
      data: {
        ownerType: "task",
        ownerId: "task-1",
        executorType: "codex",
        executorModel: null,
        executionMode: "safe",
        workingDirectory: "/tmp/project-1",
        status: "queued",
      },
    })

    const bus = createInMemoryTaskNotificationBus()
    const runtimePort = createCurrentTaskRuntimePort({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
      resolveAgentRuntime: (_type: AgentType): IAgentRuntime => {
        throw new Error("runtime unavailable")
      },
    })

    await expect(
      runtimePort.startTaskExecution({
        taskId: "task-1",
        projectId: "project-1",
        projectPath: "/tmp/project-1",
        input: "Investigate runtime failure",
        runtimeConfig: {
          executor: "codex",
          model: null,
          executionMode: "safe",
        },
      }),
    ).rejects.toThrow("runtime unavailable")

    const [task, execution, events] = await Promise.all([
      prisma.task.findUniqueOrThrow({
        where: { id: "task-1" },
      }),
      prisma.execution.findUniqueOrThrow({
        where: { ownerId: "task-1" },
      }),
      prisma.executionEvent.findMany({
        where: {
          execution: {
            ownerId: "task-1",
          },
        },
        orderBy: {
          sequence: "asc",
        },
      }),
    ])

    expect(task.status).toBe("failed")
    expect(execution.status).toBe("failed")
    expect(execution.errorMessage).toBe("runtime unavailable")
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({
      rawEventType: "message",
      source: "harbor",
      rawPayload: {
        role: "user",
        input: "Investigate runtime failure",
        summary: "Investigate runtime failure",
        source: "user_input",
      },
    })
    expect(events[1]?.rawEventType).toBe("error")
    expect(events[1]?.source).toBe("harbor")
  })
})
