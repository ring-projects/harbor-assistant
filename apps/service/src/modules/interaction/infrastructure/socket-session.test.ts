import { afterEach, describe, expect, it, vi } from "vitest"

import { AppError } from "../../../lib/errors/app-error"
import type { AuthorizationService } from "../../authorization"
import { bindWebSocketSession } from "./socket-session"
import type {
  InteractionProjectGitChangeEvent,
  InteractionSubscribeRequest,
  InteractionTaskEventItem,
  InteractionTaskEventsSnapshotMessage,
  InteractionTaskRecord,
  InteractionTaskSnapshotMessage,
  InteractionTaskStreamMessage,
  InteractionTaskTopic,
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

function createTaskSnapshotMessage(
  overrides: Partial<InteractionTaskRecord> = {},
): InteractionTaskSnapshotMessage {
  return {
    kind: "snapshot",
    name: "task",
    data: {
      task: createTask(overrides),
    },
  }
}

function createTaskEventsSnapshotMessage(args?: {
  taskOverrides?: Partial<InteractionTaskRecord>
  afterSequence?: number
  nextSequence?: number
  terminal?: boolean
  items?: InteractionTaskEventItem[]
}): InteractionTaskEventsSnapshotMessage {
  return {
    kind: "snapshot",
    name: "task_events",
    data: {
      status: createTask(args?.taskOverrides).status,
      afterSequence: args?.afterSequence ?? 0,
      items: args?.items ?? [],
      nextSequence: args?.nextSequence ?? 0,
      terminal: args?.terminal ?? false,
    },
  }
}

function createAuthorizationService(args?: {
  requireAuthorized?: AuthorizationService["requireAuthorized"]
}) {
  const requireAuthorized =
    args?.requireAuthorized ??
    vi.fn(async () => {
      return
    })

  return {
    authorize: vi.fn(),
    requireAuthorized,
  } satisfies AuthorizationService
}

async function flushAsyncWork(times = 3) {
  for (let index = 0; index < times; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
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
  listeners: Set<(message: InteractionTaskStreamMessage) => void>
  selectedTopics?: InteractionTaskTopic[]
}) {
  return {
    selectTopic(topic: InteractionTaskTopic) {
      args.selectedTopics?.push(topic)
      return {
        subscribe(listener: (message: InteractionTaskStreamMessage) => void) {
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
    },
  }
}

function emitStreamMessage(
  listeners: Set<(message: InteractionTaskStreamMessage) => void>,
  message: InteractionTaskStreamMessage,
) {
  for (const listener of listeners) {
    listener(message)
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
    const taskListeners = new Set<(message: InteractionTaskStreamMessage) => void>()
    const taskSubscribeCount = { current: 0 }
    const taskUnsubscribeCount = { current: 0 }
    const selectedTopics: InteractionTaskTopic[] = []
    const getTaskEventsSnapshot = vi.fn(async () =>
      createTaskEventsSnapshotMessage({
        taskOverrides: {
          status: "completed",
        },
        items: [createAgentEvent()],
        nextSequence: 4,
        terminal: true,
      }),
    )

    bindWebSocketSession({
      socket,
      actorPromise: Promise.resolve({ kind: "user", userId: "user-1" }),
      authorization: createAuthorizationService(),
      taskQueries: {
        getTaskSnapshot: vi.fn(),
        getTaskEventsSnapshot,
      },
      taskStream: createTaskStreamSource({
        subscribeCount: taskSubscribeCount,
        unsubscribeCount: taskUnsubscribeCount,
        listeners: taskListeners,
        selectedTopics,
      }),
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
    await flushAsyncWork()

    expect(selectedTopics).toEqual([topic])
    expect(getTaskEventsSnapshot).toHaveBeenCalledWith({
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
      message: createTaskEventsSnapshotMessage({
        taskOverrides: {
          status: "completed",
        },
        items: [createAgentEvent()],
        nextSequence: 4,
        terminal: true,
      }),
    })
    expect(taskSubscribeCount.current).toBe(1)

    emitStreamMessage(taskListeners, {
      kind: "event",
      name: "task_event",
      data: {
        event: createAgentEvent({
          id: "event-2",
        }),
      },
    })
    emitStreamMessage(taskListeners, {
      kind: "event",
      name: "task_ended",
      data: {
        status: "completed",
        cursor: 5,
      },
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
    const taskListeners = new Set<(message: InteractionTaskStreamMessage) => void>()
    const taskSubscribeCount = { current: 0 }
    const selectedTopics: InteractionTaskTopic[] = []
    const getTaskSnapshot = vi.fn(async () =>
      createTaskSnapshotMessage({
        id: "task-1",
        status: "running",
      }),
    )

    bindWebSocketSession({
      socket,
      actorPromise: Promise.resolve({ kind: "user", userId: "user-1" }),
      authorization: createAuthorizationService(),
      taskQueries: {
        getTaskSnapshot,
        getTaskEventsSnapshot: vi.fn(),
      },
      taskStream: createTaskStreamSource({
        subscribeCount: taskSubscribeCount,
        unsubscribeCount: { current: 0 },
        listeners: taskListeners,
        selectedTopics,
      }),
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
    await flushAsyncWork()

    expect(selectedTopics).toEqual([topic])
    expect(getTaskSnapshot).toHaveBeenCalledWith("task-1")
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
      message: createTaskSnapshotMessage({
        id: "task-1",
        status: "running",
      }),
    })

    emitStreamMessage(taskListeners, {
      kind: "event",
      name: "task_upsert",
      data: {
        task: createTask({
          id: "task-1",
          status: "running",
        }),
      },
    })
    emitStreamMessage(taskListeners, {
      kind: "event",
      name: "task_status_changed",
      data: {
        status: "running",
      },
    })
    emitStreamMessage(taskListeners, {
      kind: "event",
      name: "task_deleted",
      data: {
        taskId: "task-1",
        projectId: "project-1",
        orchestrationId: "orch-1",
      },
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
      actorPromise: Promise.resolve({ kind: "user", userId: "user-1" }),
      authorization: createAuthorizationService(),
      taskQueries: {
        getTaskSnapshot: vi.fn(),
        getTaskEventsSnapshot: vi.fn(),
      },
      taskStream: createTaskStreamSource({
        subscribeCount: { current: 0 },
        unsubscribeCount: { current: 0 },
        listeners: new Set(),
      }),
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
    await flushAsyncWork()

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
      actorPromise: Promise.resolve({ kind: "user", userId: "user-1" }),
      authorization: createAuthorizationService(),
      taskQueries: {
        getTaskSnapshot: vi.fn(async () => {
          throw new Error("boom")
        }),
        getTaskEventsSnapshot: vi.fn(),
      },
      taskStream: createTaskStreamSource({
        subscribeCount: { current: 0 },
        unsubscribeCount: { current: 0 },
        listeners: new Set(),
      }),
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
    await flushAsyncWork()

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

  it("emits auth errors for unauthenticated subscriptions", async () => {
    const socket = createFakeSocket()

    bindWebSocketSession({
      socket,
      actorPromise: Promise.resolve(null),
      authorization: createAuthorizationService({
        requireAuthorized: vi.fn(async () => {
          throw new AppError("AUTH_REQUIRED", 401, "Authentication required.")
        }),
      }),
      taskQueries: {
        getTaskSnapshot: vi.fn(),
        getTaskEventsSnapshot: vi.fn(),
      },
      taskStream: createTaskStreamSource({
        subscribeCount: { current: 0 },
        unsubscribeCount: { current: 0 },
        listeners: new Set(),
      }),
      projectGitWatcher: {
        subscribe: vi.fn(),
      },
    })

    socket.trigger("interaction:subscribe", {
      topic: {
        kind: "task",
        id: "task-1",
      },
    } satisfies InteractionSubscribeRequest)
    await flushAsyncWork()

    expect(emittedMessages(socket)).toContainEqual({
      event: "interaction:message",
      payload: {
        topic: {
          kind: "task",
          id: "task-1",
        },
        message: {
          kind: "error",
          error: {
            code: "AUTH_REQUIRED",
            message: "Authentication required.",
          },
        },
      },
    })
  })
})
