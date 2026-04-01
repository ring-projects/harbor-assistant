import { afterEach, describe, expect, it } from "vitest"

import { createTestDatabase, type TestDatabase } from "../../../../../test/helpers/test-database"
import { createInMemoryTaskNotificationBus } from "../notification/in-memory-task-notification-bus"
import { PrismaTaskRepository } from "../persistence/prisma-task-repository"
import { createTaskExecutionStateStore } from "./task-execution-state"

describe("task execution state store", () => {
  let database: TestDatabase | null = null

  afterEach(async () => {
    await database?.cleanup()
    database = null
  })

  it("does not allow a later completed transition to overwrite cancelled", async () => {
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
    await prisma.orchestration.create({
      data: {
        id: "orchestration-1",
        projectId: "project-1",
        title: "Project 1",
      },
    })

    await prisma.task.create({
      data: {
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orchestration-1",
        prompt: "Investigate runtime failure",
        title: "Investigate runtime failure",
        status: "running",
        startedAt: new Date("2026-03-29T00:00:00.000Z"),
      },
    })

    await prisma.execution.create({
      data: {
        ownerType: "task",
        ownerId: "task-1",
        executorType: "codex",
        executorModel: null,
        executionMode: "safe",
        executorEffort: "medium",
        workingDirectory: "/tmp/project-1",
        sessionId: "session-1",
        status: "running",
        startedAt: new Date("2026-03-29T00:00:00.000Z"),
      },
    })

    const stateStore = createTaskExecutionStateStore({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: createInMemoryTaskNotificationBus().publisher,
    })

    const cancelled = await stateStore.markCancelled({
      executionId: (
        await prisma.execution.findUniqueOrThrow({
          where: {
            ownerId: "task-1",
          },
          select: {
            id: true,
          },
        })
      ).id,
      taskId: "task-1",
      finishedAt: new Date("2026-03-29T00:01:00.000Z"),
      sessionId: "session-1",
    })

    const completed = await stateStore.markCompleted({
      executionId: (
        await prisma.execution.findUniqueOrThrow({
          where: {
            ownerId: "task-1",
          },
          select: {
            id: true,
          },
        })
      ).id,
      taskId: "task-1",
      finishedAt: new Date("2026-03-29T00:02:00.000Z"),
      sessionId: "session-1",
      exitCode: 0,
    })

    const [task, execution] = await Promise.all([
      prisma.task.findUniqueOrThrow({
        where: { id: "task-1" },
      }),
      prisma.execution.findUniqueOrThrow({
        where: { ownerId: "task-1" },
      }),
    ])

    expect(cancelled).toBe(true)
    expect(completed).toBe(false)
    expect(task.status).toBe("cancelled")
    expect(execution.status).toBe("cancelled")
  })
})
