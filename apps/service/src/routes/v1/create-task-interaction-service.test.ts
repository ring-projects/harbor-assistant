import { describe, expect, it } from "vitest"

import { createTask } from "../../modules/task/domain/task"
import { attachTaskRuntime } from "../../modules/task/application/task-read-models"
import { InMemoryTaskEventProjection } from "../../modules/task/infrastructure/in-memory-task-event-projection"
import { InMemoryTaskRepository } from "../../modules/task/infrastructure/in-memory-task-repository"
import { createInMemoryTaskNotificationBus } from "../../modules/task/infrastructure/notification/in-memory-task-notification-bus"
import { createTaskInteractionService } from "./create-task-interaction-service"

describe("createTaskInteractionService", () => {
  it("maps task read models to interaction queries", async () => {
    const repository = new InMemoryTaskRepository([
      attachTaskRuntime(
        createTask({
          id: "task-1",
          projectId: "project-1",
          orchestrationId: "orch-1",
          prompt: "Investigate runtime drift",
          status: "completed",
          createdAt: new Date("2026-03-25T00:00:00.000Z"),
          updatedAt: new Date("2026-03-25T00:10:00.000Z"),
          finishedAt: new Date("2026-03-25T00:20:00.000Z"),
        }),
        {
          executor: "codex",
          model: "gpt-5.3-codex",
          executionMode: "safe",
          effort: null,
        },
      ),
    ])
    const eventProjection = new InMemoryTaskEventProjection({
      "task-1": [
        {
          id: "event-1",
          taskId: "task-1",
          sequence: 1,
          eventType: "session.started",
          payload: {
            sessionId: "session-1",
          },
          createdAt: new Date("2026-03-25T00:00:30.000Z"),
        },
      ],
    })
    const notificationBus = createInMemoryTaskNotificationBus()

    const service = createTaskInteractionService({
      repository,
      eventProjection,
      notificationSubscriber: notificationBus.subscriber,
    })

    await expect(service.queries.getTaskDetail("task-1")).resolves.toEqual(
      expect.objectContaining({
        id: "task-1",
        orchestrationId: "orch-1",
        prompt: "Investigate runtime drift",
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "safe",
        effort: null,
      }),
    )

    await expect(
      service.queries.getTaskEvents({
        taskId: "task-1",
        afterSequence: 0,
        limit: 50,
      }),
    ).resolves.toEqual({
      task: expect.objectContaining({
        id: "task-1",
        orchestrationId: "orch-1",
        status: "completed",
      }),
      events: {
        taskId: "task-1",
        items: [
          {
            id: "event-1",
            taskId: "task-1",
            sequence: 1,
            eventType: "session.started",
            payload: {
              sessionId: "session-1",
            },
            createdAt: "2026-03-25T00:00:30.000Z",
          },
        ],
        nextSequence: 2,
      },
      isTerminal: true,
    })
  })

  it("maps task notifications into interaction streams", async () => {
    const repository = new InMemoryTaskRepository()
    const eventProjection = new InMemoryTaskEventProjection()
    const notificationBus = createInMemoryTaskNotificationBus()
    const service = createTaskInteractionService({
      repository,
      eventProjection,
      notificationSubscriber: notificationBus.subscriber,
    })

    const taskEvents: unknown[] = []
    const taskSubscription = service.stream
      .selectTask("task-1")
      .subscribe((event) => taskEvents.push(event))

    await notificationBus.publisher.publish({
      type: "task_upserted",
      projectId: "project-1",
      task: {
        id: "task-1",
        projectId: "project-1",
        orchestrationId: "orch-1",
        title: "Investigate runtime drift",
        titleSource: "prompt",
        executor: "codex",
        model: "gpt-5.3-codex",
        executionMode: "safe",
        effort: null,
        status: "completed",
        archivedAt: null,
        createdAt: new Date("2026-03-25T00:00:00.000Z"),
        updatedAt: new Date("2026-03-25T00:10:00.000Z"),
        startedAt: new Date("2026-03-25T00:05:00.000Z"),
        finishedAt: new Date("2026-03-25T00:20:00.000Z"),
      },
    })
    await notificationBus.publisher.publish({
      type: "task_event_appended",
      projectId: "project-1",
      taskId: "task-1",
      event: {
        id: "event-1",
        taskId: "task-1",
        sequence: 1,
        eventType: "message",
        payload: {
          content: "hello",
        },
        createdAt: new Date("2026-03-25T00:06:00.000Z"),
      },
    })
    await notificationBus.publisher.publish({
      type: "task_deleted",
      projectId: "project-1",
      orchestrationId: "orch-1",
      taskId: "task-1",
    })

    await taskSubscription.unsubscribe()

    expect(taskEvents).toEqual([
      {
        type: "task_upsert",
        task: expect.objectContaining({
          id: "task-1",
          orchestrationId: "orch-1",
          executor: "codex",
          status: "completed",
        }),
      },
      {
        type: "task_status",
        taskId: "task-1",
        status: "completed",
      },
      {
        type: "task_end",
        taskId: "task-1",
        status: "completed",
        cursor: 0,
      },
      {
        type: "agent_event",
        taskId: "task-1",
        event: {
          id: "event-1",
          taskId: "task-1",
          sequence: 1,
          eventType: "message",
          payload: {
            content: "hello",
          },
          createdAt: "2026-03-25T00:06:00.000Z",
        },
      },
      {
        type: "task_deleted",
        projectId: "project-1",
        orchestrationId: "orch-1",
        taskId: "task-1",
      },
    ])
  })
})
