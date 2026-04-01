import Fastify from "fastify"
import { afterEach, describe, expect, it } from "vitest"

import { createInteractionSocketGateway } from "./socket-io-gateway"
import type {
  InteractionProjectGitChangeEvent,
  InteractionSubscribeRequest,
  InteractionTaskRecord,
  InteractionTaskStreamEvent,
  InteractionTopic,
  ProjectGitInteractionLifecycle,
  TaskInteractionQueries,
  TaskInteractionStream,
} from "../application/ports"
import type { WebSocketInteractionMessage } from "../domain/websocket-contract"

const socketClientModuleUrl = new URL(
  "../../../../../../node_modules/.pnpm/socket.io-client@4.8.3/node_modules/socket.io-client/build/esm/index.js",
  import.meta.url,
)

type ClientSocket = {
  close(): void
  connect(): void
  emit(event: string, payload?: unknown): void
  off(event: string, handler: (...args: unknown[]) => void): void
  on(event: string, handler: (...args: unknown[]) => void): void
}

const clientsToClose = new Set<ClientSocket>()

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

function createTaskStreamSource(args: {
  listeners: Set<(event: InteractionTaskStreamEvent) => void>
  onUnsubscribe?: () => void
}) {
  return {
    subscribe(listener: (event: InteractionTaskStreamEvent) => void) {
      args.listeners.add(listener)
      return {
        unsubscribe() {
          args.listeners.delete(listener)
          args.onUnsubscribe?.()
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

function waitForClientConnect(client: ClientSocket) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error("Timed out waiting for websocket connection"))
    }, 2_000)

    const onConnect = () => {
      cleanup()
      resolve()
    }
    const onError = (...args: unknown[]) => {
      cleanup()
      const [error] = args
      reject(error instanceof Error ? error : new Error(String(error)))
    }

    function cleanup() {
      clearTimeout(timeout)
      client.off("connect", onConnect)
      client.off("connect_error", onError)
    }

    client.on("connect", onConnect)
    client.on("connect_error", onError)
  })
}

function waitForInteractionMessage(
  client: ClientSocket,
  predicate: (message: WebSocketInteractionMessage) => boolean,
) {
  return new Promise<WebSocketInteractionMessage>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error("Timed out waiting for interaction message"))
    }, 2_000)

    const handler = (...args: unknown[]) => {
      const [message] = args as [WebSocketInteractionMessage]
      if (!predicate(message)) {
        return
      }

      cleanup()
      resolve(message)
    }

    function cleanup() {
      clearTimeout(timeout)
      client.off("interaction:message", handler)
    }

    client.on("interaction:message", handler)
  })
}

function waitForCondition(
  condition: () => boolean,
  message: string,
  timeoutMs = 2_000,
) {
  return new Promise<void>((resolve, reject) => {
    const startedAt = Date.now()

    function poll() {
      if (condition()) {
        resolve()
        return
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(message))
        return
      }

      setTimeout(poll, 10)
    }

    poll()
  })
}

async function createClientSocket(url: string): Promise<ClientSocket> {
  const clientModule = (await import(socketClientModuleUrl.href)) as {
    io: (url: string, options?: Record<string, unknown>) => ClientSocket
  }

  const client = clientModule.io(url, {
    path: "/socket.io",
    transports: ["websocket"],
    forceNew: true,
    reconnection: false,
    autoConnect: true,
  })
  clientsToClose.add(client)
  await waitForClientConnect(client)
  return client
}

async function createLiveGatewayApp(args?: {
  taskQueries?: TaskInteractionQueries
  taskStream?: TaskInteractionStream
  projectGitWatcher?: ProjectGitInteractionLifecycle
}) {
  const app = Fastify({ logger: false })
  const taskListeners = new Set<(event: InteractionTaskStreamEvent) => void>()

  const taskQueries: TaskInteractionQueries = args?.taskQueries ?? {
    getTaskDetail: async () => createTask(),
    getTaskEvents: async () => ({
      task: createTask(),
      events: {
        taskId: "task-1",
        items: [],
        nextSequence: 0,
      },
      isTerminal: false,
    }),
  }

  const taskStream: TaskInteractionStream = args?.taskStream ?? {
    selectTask: () =>
      createTaskStreamSource({
        listeners: taskListeners,
      }),
  }

  const projectGitWatcher: ProjectGitInteractionLifecycle =
    args?.projectGitWatcher ?? {
      async subscribe() {
        return async () => {}
      },
      async close() {},
    }

  createInteractionSocketGateway({
    app,
    taskQueries,
    taskStream,
    projectGitWatcher,
  })

  await app.listen({
    host: "127.0.0.1",
    port: 0,
  })

  const address = app.server.address()
  if (!address || typeof address === "string") {
    throw new Error("Expected interaction gateway to listen on a TCP port")
  }

  return {
    app,
    url: `http://127.0.0.1:${address.port}`,
    taskListeners,
  }
}

afterEach(async () => {
  for (const client of clientsToClose) {
    client.close()
  }
  clientsToClose.clear()
})

describe("createInteractionSocketGateway", () => {
  it("forwards project git changes and cleans watcher subscriptions on disconnect", async () => {
    let unsubscribeCount = 0
    let projectGitListener:
      | ((event: InteractionProjectGitChangeEvent) => void)
      | undefined
    const topic: InteractionTopic = {
      kind: "project-git",
      id: "project-1",
    }

    const { app, url } = await createLiveGatewayApp({
      projectGitWatcher: {
        async subscribe(_projectId, onChange) {
          projectGitListener = onChange
          return async () => {
            unsubscribeCount += 1
          }
        },
        async close() {},
      },
    })

    try {
      const client = await createClientSocket(url)
      const subscribedPromise = waitForInteractionMessage(
        client,
        (message) =>
          message.topic?.kind === "project-git" &&
          message.topic.id === "project-1" &&
          message.message.kind === "subscribed",
      )

      client.emit("interaction:subscribe", {
        topic,
      } satisfies InteractionSubscribeRequest)

      await expect(subscribedPromise).resolves.toEqual({
        topic,
        message: {
          kind: "subscribed",
        },
      })

      if (!projectGitListener) {
        throw new Error("Expected project git listener to be registered")
      }

      const changePromise = waitForInteractionMessage(
        client,
        (message) =>
          message.topic?.kind === "project-git" &&
          message.topic.id === "project-1" &&
          message.message.kind === "event" &&
          message.message.name === "project_git_changed",
      )

      projectGitListener({
        projectId: "project-1",
        changedAt: "2026-03-24T08:00:00.000Z",
      })

      await expect(changePromise).resolves.toEqual({
        topic,
        message: {
          kind: "event",
          name: "project_git_changed",
          data: {
            changedAt: "2026-03-24T08:00:00.000Z",
          },
        },
      })

      client.close()

      await waitForCondition(
        () => unsubscribeCount === 1,
        "Expected project git watcher subscription to be cleaned up",
      )
    } finally {
      await app.close()
    }
  })

  it("cleans task stream subscriptions when a real websocket client disconnects", async () => {
    let unsubscribeCount = 0
    const topic: InteractionTopic = {
      kind: "task",
      id: "task-1",
    }

    const { app, url } = await createLiveGatewayApp({
      taskStream: {
        selectTask: () =>
          createTaskStreamSource({
            listeners: new Set(),
            onUnsubscribe() {
              unsubscribeCount += 1
            },
          }),
      },
    })

    try {
      const client = await createClientSocket(url)
      const snapshotPromise = waitForInteractionMessage(
        client,
        (message) =>
          message.topic?.kind === "task" &&
          message.topic.id === "task-1" &&
          message.message.kind === "snapshot" &&
          message.message.name === "task",
      )

      client.emit("interaction:subscribe", {
        topic,
      } satisfies InteractionSubscribeRequest)

      await expect(snapshotPromise).resolves.toEqual({
        topic,
        message: {
          kind: "snapshot",
          name: "task",
          data: {
            task: createTask(),
          },
        },
      })

      client.close()

      await waitForCondition(
        () => unsubscribeCount === 1,
        "Expected task stream subscription to be cleaned up",
      )
    } finally {
      await app.close()
    }
  })
})
