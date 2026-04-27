import { afterEach, describe, expect, it } from "vitest"

import {
  createTestDatabase,
  type TestDatabase,
} from "../../../../../test/helpers/test-database"
import { createInMemoryTaskNotificationBus } from "../notification/in-memory-task-notification-bus"
import { PrismaTaskRepository } from "../persistence/prisma-task-repository"
import { createTaskExecutionLifecycle } from "./task-execution-lifecycle"

describe("Task execution lifecycle", () => {
  let database: TestDatabase | null = null

  afterEach(async () => {
    await database?.cleanup()
    database = null
  })

  it("marks orphaned queued and running executions as failed on service startup", async () => {
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

    await prisma.task.createMany({
      data: [
        {
          id: "task-running",
          projectId: "project-1",
          orchestrationId: "orchestration-1",
          prompt: "Continue debugging",
          title: "Continue debugging",
          status: "running",
          startedAt: new Date("2026-03-27T00:00:00.000Z"),
        },
        {
          id: "task-queued",
          projectId: "project-1",
          orchestrationId: "orchestration-1",
          prompt: "Start analysis",
          title: "Start analysis",
          status: "queued",
        },
      ],
    })

    await prisma.execution.createMany({
      data: [
        {
          ownerType: "task",
          ownerId: "task-running",
          executorType: "codex",
          workingDirectory: "/tmp/project-1",
          sessionId: "session-running",
          status: "running",
          startedAt: new Date("2026-03-27T00:00:00.000Z"),
        },
        {
          ownerType: "task",
          ownerId: "task-queued",
          executorType: "codex",
          workingDirectory: "/tmp/project-1",
          status: "queued",
        },
      ],
    })

    const bus = createInMemoryTaskNotificationBus()
    const lifecycle = createTaskExecutionLifecycle({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
    })

    await expect(lifecycle.reconcileOrphanedExecutions()).resolves.toBe(2)

    const [runningTask, queuedTask] = await Promise.all([
      prisma.task.findUniqueOrThrow({
        where: { id: "task-running" },
      }),
      prisma.task.findUniqueOrThrow({
        where: { id: "task-queued" },
      }),
    ])
    expect(runningTask.status).toBe("failed")
    expect(queuedTask.status).toBe("failed")

    const [runningExecution, queuedExecution] = await Promise.all([
      prisma.execution.findUniqueOrThrow({
        where: { ownerId: "task-running" },
      }),
      prisma.execution.findUniqueOrThrow({
        where: { ownerId: "task-queued" },
      }),
    ])
    expect(runningExecution.status).toBe("failed")
    expect(runningExecution.errorMessage).toContain(
      "restarted while the run was in progress",
    )
    expect(runningExecution.errorMessage).toContain("can be resumed")
    expect(queuedExecution.status).toBe("failed")
    expect(queuedExecution.errorMessage).toContain(
      "restarted before the queued run began",
    )
    expect(queuedExecution.errorMessage).toContain("No resumable session")

    const runningEvents = await prisma.executionEvent.findMany({
      where: {
        executionId: runningExecution.id,
      },
      orderBy: {
        sequence: "asc",
      },
    })
    const queuedEvents = await prisma.executionEvent.findMany({
      where: {
        executionId: queuedExecution.id,
      },
      orderBy: {
        sequence: "asc",
      },
    })

    expect(runningEvents).toHaveLength(1)
    expect(runningEvents[0]?.rawEventType).toBe("error")
    expect(runningEvents[0]?.source).toBe("harbor")
    expect(queuedEvents).toHaveLength(1)
    expect(queuedEvents[0]?.rawEventType).toBe("error")
    expect(queuedEvents[0]?.source).toBe("harbor")
  })
})
