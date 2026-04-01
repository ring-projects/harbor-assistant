import { afterEach, describe, expect, it } from "vitest"

import { createTestDatabase, type TestDatabase } from "../../../../test/helpers/test-database"
import type { AgentInput, AgentRuntimeOptions, AgentType, IAgentRuntime } from "../../../lib/agents"
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
        executorEffort: "medium",
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
          effort: "medium",
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

  it("uses the supplied runtime snapshot when resuming an execution", async () => {
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
        status: "completed",
      },
    })

    await prisma.execution.create({
      data: {
        ownerType: "task",
        ownerId: "task-1",
        executorType: "codex",
        executorModel: "gpt-5.3-codex",
        executionMode: "safe",
        executorEffort: "high",
        workingDirectory: "/tmp/project-1",
        sessionId: "session-1",
        status: "completed",
      },
    })

    let resolveResumeCall:
      | ((value: {
          sessionId: string
          options: AgentRuntimeOptions
          input: AgentInput
        }) => void)
      | null = null
    const resumeCall = new Promise<{
      sessionId: string
      options: AgentRuntimeOptions
      input: AgentInput
    }>((resolve) => {
      resolveResumeCall = resolve
    })

    const runtime: IAgentRuntime = {
      type: "codex",
      async *startSessionAndRun() {},
      resumeSessionAndRun(sessionId, options, input) {
        resolveResumeCall?.({
          sessionId,
          options,
          input,
        })
        return (async function* () {})()
      },
    }

    const bus = createInMemoryTaskNotificationBus()
    const runtimePort = createCurrentTaskRuntimePort({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
      resolveAgentRuntime: (_type: AgentType) => runtime,
    })

    await runtimePort.resumeTaskExecution({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: "/tmp/project-1",
      input: "Continue from the saved execution state.",
      runtimeConfig: {
        executor: "codex",
        model: null,
        executionMode: "safe",
        effort: null,
      },
    })

    await expect(resumeCall).resolves.toMatchObject({
      sessionId: "session-1",
      input: "Continue from the saved execution state.",
      options: expect.objectContaining({
        modelId: undefined,
        effort: undefined,
      }),
    })

    await expect.poll(async () => {
      const execution = await prisma.execution.findUnique({
        where: {
          ownerId: "task-1",
        },
        select: {
          executorModel: true,
          executorEffort: true,
        },
      })

      return execution
    }).toEqual({
      executorModel: null,
      executorEffort: null,
    })

    await expect.poll(async () => {
      const execution = await prisma.execution.findUnique({
        where: {
          ownerId: "task-1",
        },
        select: {
          status: true,
        },
      })

      return execution?.status ?? null
    }).toBe("completed")
  })

  it("cancels an in-flight execution through the runtime abort signal", async () => {
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
        executorEffort: "medium",
        workingDirectory: "/tmp/project-1",
        status: "queued",
      },
    })

    let observedAbort = false
    let resolveStarted: (() => void) | null = null
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve
    })

    const runtime: IAgentRuntime = {
      type: "codex",
      async *startSessionAndRun(_options, _input, signal) {
        resolveStarted?.()

        yield {
          agentType: "codex",
          createdAt: new Date("2026-03-29T00:00:00.000Z"),
          event: {
            type: "thread.started",
            thread_id: "session-cancel",
          },
        }

        await new Promise<never>((_resolve, reject) => {
          if (!signal) {
            reject(new Error("missing abort signal"))
            return
          }

          if (signal.aborted) {
            observedAbort = true
            reject(new Error(String(signal.reason ?? "aborted")))
            return
          }

          signal.addEventListener(
            "abort",
            () => {
              observedAbort = true
              reject(new Error(String(signal.reason ?? "aborted")))
            },
            { once: true },
          )
        })
      },
      async *resumeSessionAndRun() {},
    }

    const bus = createInMemoryTaskNotificationBus()
    const runtimePort = createCurrentTaskRuntimePort({
      prisma,
      taskRepository: new PrismaTaskRepository(prisma),
      notificationPublisher: bus.publisher,
      resolveAgentRuntime: (_type: AgentType) => runtime,
    })

    await runtimePort.startTaskExecution({
      taskId: "task-1",
      projectId: "project-1",
      projectPath: "/tmp/project-1",
      input: "Investigate runtime failure",
      runtimeConfig: {
        executor: "codex",
        model: null,
        executionMode: "safe",
        effort: "medium",
      },
    })

    await started
    expect(observedAbort).toBe(false)

    await runtimePort.cancelTaskExecution({
      taskId: "task-1",
      reason: "User requested stop",
    })

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

    expect(observedAbort).toBe(true)
    expect(task.status).toBe("cancelled")
    expect(execution.status).toBe("cancelled")
    expect(execution.sessionId).toBe("session-cancel")
    expect(events.map((event) => event.rawEventType)).toEqual(
      expect.arrayContaining([
        "message",
        "session.started",
        "harbor.cancel_requested",
        "harbor.cancelled",
      ]),
    )
  })
})
