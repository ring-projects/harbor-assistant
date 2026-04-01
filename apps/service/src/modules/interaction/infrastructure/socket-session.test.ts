import { afterEach, describe, expect, it, vi } from "vitest"

import { bindWebSocketSession } from "./socket-session"
import type {
  InteractionProjectGitChangeEvent,
  InteractionSubscribeRequest,
  InteractionTaskEventItem,
  InteractionTaskRecord,
  InteractionTaskStreamEvent,
  InteractionTopic,
} from "../application/ports"

function createTask(
  overrides: Partial<InteractionTaskRecord> = {},
): InteractionTaskRecord {
  return {
    id: "task-1",
    projectId: "project-1",
    orchestrationId: "orch-1",
    title: "Investigate runtime drift",
    titleSource: "prompt",
    executor: "codex",
    model: null,
    executionMode: "safe",
    effort: null,
    status: "queued",
    archivedAt: null,
    createdAt: "2026-03-24T00:00:00.000Z",
    updatedAt: "2026-03-24T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    ...overrides,
  }
}

function createAgentEvent(
  overrides: Partial<InteractionTaskEventItem> = {},
): InteractionTaskEventItem {
  return {
    id: "event-1",
    taskId: "task-1",
    sequence: 3,
    eventType: "message",
    payload: {
      content: "hello",
    },
    createdAt: "2026-03-24T00:00:00.000Z",
    ...overrides,
  }
}

function createFakeSocket() {
  const handlers = new Map<string, (payload?: unknown) => void>()
  const emitted: Array<[string, unknown]> = []
  const joined: string[] = []
  const left: string[] = []

  return {
    emitted,
    joined,
    left,
    on(event: string, handler: (payload?: unknown) => void) {
      handlers.set(event, handler)
    },
    emit(event: string, payload: unknown) {
      emitted.push([event, payload])
    },
    join(room: string) {
      joined.push(room)
    },
    leave(room: string) {
      left.push(room)
    },
    trigger(event: string, payload?: unknown) {
      const handler = handlers.get(event)
      if (!handler) {
        throw new Error(`Missing handler for ${event}`)
      }

      handler(payload)
    },
  }
}

function createTaskStreamSource(args: {
  subscribeCount: { current: number }
  unsubscribeCount: { current: number }
  listeners: Set<(event: InteractionTaskStreamEvent) => void>
}) {
  return {
    subscribe(listener: (event: InteractionTaskStreamEvent) => void) {
      args.subscribeCount.current += 1
      args.listeners.add(listener)
      return {
        unsubscribe() {
          args.unsubscribeCount.current += 1
          args.listeners.delete(listener)
        },
      }
    },
  }
}

function emitStreamEvent(
  listeners: Set<(event: InteractionTaskStreamEvent) => void>,
  event: InteractionTaskStreamEvent,
) {
  for (const listener of listeners) {
    listener(event)
  }
}

function emittedMessages(socket: ReturnType<typeof createFakeSocket>) {
  return socket.emitted.map(([event, payload]) => ({
    event,
    payload,
  }))
}

function expectSocketMessage(
  socket: ReturnType<typeof createFakeSocket>,
  expected: unknown,
) {
  expect(emittedMessages(socket)).toContainEqual({
    event: "interaction:message",
    payload: expected,
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("bindWebSocketSession", () => {
  it("replays task-events snapshot, forwards live task events, and cleans up on disconnect", async () => {
    const socket = createFakeSocket()
    const taskListeners = new Set<(event: InteractionTaskStreamEvent) => void>()
    const taskSubscribeCount = { current: 0 }
    const taskUnsubscribeCount = { current: 0 }
    const getTaskEvents = vi.fn(async () => ({
      task: createTask({
        status: "completed",
      }),
      events: {
        taskId: "task-1",
        items: [createAgentEvent()],
        nextSequence: 4,
      },
      isTerminal: true,
    }))

    bindWebSocketSession({
      socket,
      taskQueries: {
        getTaskDetail: vi.fn(),
        getTaskEvents,
      },
      taskStream: {
        selectTask: () =>
          createTaskStreamSource({
            subscribeCount: taskSubscribeCount,
            unsubscribeCount: taskUnsubscribeCount,
            listeners: taskListeners,
          }),
      },
      projectGitWatcher: {
        subscribe: vi.fn(),
      },
    })

    const topic: InteractionTopic = {
      kind: "task-events",
      id: "task-1",
    }

    socket.trigger("interaction:subscribe", {
      topic: {
        kind: "task-events",
        id: " task-1 ",
      },
      afterSequence: -2,
      limit: 0,
    } satisfies InteractionSubscribeRequest)
    await Promise.resolve()

    expect(getTaskEvents).toHaveBeenCalledWith({
      taskId: "task-1",
      afterSequence: 0,
      limit: 500,
    })
    expect(socket.joined).toEqual(["task-events:task-1"])
    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "subscribed",
      },
    })
    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "snapshot",
        name: "task_events",
        data: {
          status: "completed",
          afterSequence: 0,
          items: [createAgentEvent()],
          nextSequence: 4,
          terminal: true,
        },
      },
    })
    expect(taskSubscribeCount.current).toBe(1)

    emitStreamEvent(taskListeners, {
      type: "agent_event",
      taskId: "task-1",
      event: createAgentEvent({
        id: "event-2",
      }),
    })
    emitStreamEvent(taskListeners, {
      type: "task_end",
      taskId: "task-1",
      status: "completed",
      cursor: 5,
    })

    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "event",
        name: "task_event",
        data: {
          event: createAgentEvent({
            id: "event-2",
          }),
        },
      },
    })
    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "event",
        name: "task_ended",
        data: {
          status: "completed",
          cursor: 5,
        },
      },
    })

    socket.trigger("disconnect")

    expect(taskUnsubscribeCount.current).toBe(1)
  })

  it("replays task snapshot and forwards task status updates", async () => {
    const socket = createFakeSocket()
    const taskListeners = new Set<(event: InteractionTaskStreamEvent) => void>()
    const taskSubscribeCount = { current: 0 }
    const getTaskDetail = vi.fn(async () =>
      createTask({
        id: "task-1",
        status: "running",
      }),
    )

    bindWebSocketSession({
      socket,
      taskQueries: {
        getTaskDetail,
        getTaskEvents: vi.fn(),
      },
      taskStream: {
        selectTask: () =>
          createTaskStreamSource({
            subscribeCount: taskSubscribeCount,
            unsubscribeCount: { current: 0 },
            listeners: taskListeners,
          }),
      },
      projectGitWatcher: {
        subscribe: vi.fn(),
      },
    })

    const topic: InteractionTopic = {
      kind: "task",
      id: "task-1",
    }

    socket.trigger("interaction:subscribe", {
      topic: {
        kind: "task",
        id: " task-1 ",
      },
    } satisfies InteractionSubscribeRequest)
    await Promise.resolve()

    expect(getTaskDetail).toHaveBeenCalledWith("task-1")
    expect(taskSubscribeCount.current).toBe(1)
    expect(socket.joined).toEqual(["task:task-1"])
    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "subscribed",
      },
    })
    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "snapshot",
        name: "task",
        data: {
          task: createTask({
            id: "task-1",
            status: "running",
          }),
        },
      },
    })

    emitStreamEvent(taskListeners, {
      type: "task_upsert",
      task: createTask({
        id: "task-1",
        status: "running",
      }),
    })
    emitStreamEvent(taskListeners, {
      type: "task_status",
      taskId: "task-1",
      status: "running",
    })
    emitStreamEvent(taskListeners, {
      type: "task_deleted",
      taskId: "task-1",
      projectId: "project-1",
      orchestrationId: "orch-1",
    })

    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "event",
        name: "task_upsert",
        data: {
          task: createTask({
            id: "task-1",
            status: "running",
          }),
        },
      },
    })
    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "event",
        name: "task_status_changed",
        data: {
          status: "running",
        },
      },
    })
    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "event",
        name: "task_deleted",
        data: {
          taskId: "task-1",
          projectId: "project-1",
          orchestrationId: "orch-1",
        },
      },
    })
  })

  it("subscribes to project git changes and forwards watcher events", async () => {
    const socket = createFakeSocket()
    const unsubscribe = vi.fn(async () => {})
    const listenerRef: {
      current: ((event: InteractionProjectGitChangeEvent) => void) | null
    } = {
      current: null,
    }

    bindWebSocketSession({
      socket,
      taskQueries: {
        getTaskDetail: vi.fn(),
        getTaskEvents: vi.fn(),
      },
      taskStream: {
        selectTask: () =>
          createTaskStreamSource({
            subscribeCount: { current: 0 },
            unsubscribeCount: { current: 0 },
            listeners: new Set(),
          }),
      },
      projectGitWatcher: {
        subscribe: vi.fn(async (_projectId, listener) => {
          listenerRef.current = listener
          return unsubscribe
        }),
      },
    })

    const topic: InteractionTopic = {
      kind: "project-git",
      id: "project-1",
    }

    socket.trigger("interaction:subscribe", {
      topic,
    } satisfies InteractionSubscribeRequest)
    await Promise.resolve()

    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "subscribed",
      },
    })

    if (!listenerRef.current) {
      throw new Error("Expected project git listener to be registered")
    }

    listenerRef.current({
      projectId: "project-1",
      changedAt: "2026-03-24T08:00:00.000Z",
    })

    expectSocketMessage(socket, {
      topic,
      message: {
        kind: "event",
        name: "project_git_changed",
        data: {
          changedAt: "2026-03-24T08:00:00.000Z",
        },
      },
    })

    socket.trigger("interaction:unsubscribe", {
      topic,
    } satisfies InteractionSubscribeRequest)

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it("emits structured errors for invalid topics and failing query replays", async () => {
    const socket = createFakeSocket()

    bindWebSocketSession({
      socket,
      taskQueries: {
        getTaskDetail: vi.fn(async () => {
          throw new Error("boom")
        }),
        getTaskEvents: vi.fn(),
      },
      taskStream: {
        selectTask: () =>
          createTaskStreamSource({
            subscribeCount: { current: 0 },
            unsubscribeCount: { current: 0 },
            listeners: new Set(),
          }),
      },
      projectGitWatcher: {
        subscribe: vi.fn(),
      },
    })

    socket.trigger("interaction:subscribe", {
      topic: {
        kind: "invalid",
        id: "project-1",
      },
    })
    socket.trigger("interaction:subscribe", {
      topic: {
        kind: "task",
        id: "task-1",
      },
    } satisfies InteractionSubscribeRequest)
    await Promise.resolve()

    expect(emittedMessages(socket)).toContainEqual({
      event: "interaction:message",
      payload: expect.objectContaining({
        message: {
          kind: "error",
          error: expect.objectContaining({
            code: expect.any(String),
          }),
        },
      }),
    })
  })
})
