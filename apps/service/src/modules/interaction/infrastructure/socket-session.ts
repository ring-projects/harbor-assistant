import type {
  InteractionProjectGitChangeEvent,
  InteractionSubscribeRequest,
  InteractionTaskMessage,
  InteractionTaskTopic,
  InteractionTopic,
  ProjectGitInteractionWatcher,
  TaskInteractionQueries,
  TaskInteractionStream,
} from "../application/ports"
import type {
  AuthorizationActor,
  AuthorizationService,
} from "../../authorization"
import {
  interactionTopicKey,
  interactionTopicRoom,
  type ParsedInteractionSubscription,
  parseInteractionSubscription,
} from "../domain/subscription-topics"
import {
  emitWebSocketMessage,
  errorEnvelope,
  interactionMessageEnvelope,
  projectGitChangedEventEnvelope,
  subscribedEnvelope,
  unsubscribedEnvelope,
} from "../domain/websocket-contract"
import { createInteractionError, toInteractionMessageError } from "../errors"

type SocketSessionLike = {
  emit(event: string, payload: unknown): void
  join(room: string): void
  leave(room: string): void
  on(event: string, handler: (payload?: unknown) => void): void
}

function emitInteractionError(
  socket: Pick<SocketSessionLike, "emit">,
  error: unknown,
  topic?: InteractionTopic,
) {
  emitWebSocketMessage(
    socket,
    errorEnvelope({
      ...(topic ? { topic } : {}),
      error: toInteractionMessageError(error),
    }),
  )
}

function emitTaskMessage(
  socket: Pick<SocketSessionLike, "emit">,
  topic: InteractionTaskTopic,
  message: InteractionTaskMessage,
) {
  emitWebSocketMessage(
    socket,
    interactionMessageEnvelope({
      topic,
      message,
    }),
  )
}

function emitProjectGitChanged(
  socket: Pick<SocketSessionLike, "emit">,
  topic: InteractionTopic,
  event: InteractionProjectGitChangeEvent,
) {
  emitWebSocketMessage(
    socket,
    projectGitChangedEventEnvelope({
      topic,
      changedAt: event.changedAt,
    }),
  )
}

function toActor(actor: AuthorizationActor | null): AuthorizationActor {
  return actor ?? { kind: "user", userId: "" }
}

async function resolveSocketActor(
  actorPromise: Promise<AuthorizationActor | null>,
) {
  return toActor(await actorPromise)
}

async function replayTaskSnapshot(args: {
  socket: SocketSessionLike
  taskQueries: Pick<TaskInteractionQueries, "getTaskSnapshot">
  authorization: AuthorizationService
  actorPromise: Promise<AuthorizationActor | null>
  request: InteractionSubscribeRequest
}) {
  const parsed = parseInteractionSubscription(args.request)
  if (!parsed || parsed.topic.kind !== "task") {
    emitInteractionError(
      args.socket,
      createInteractionError().invalidTopic("Task topic is invalid."),
    )
    return
  }

  try {
    const topic = parsed.topic
    await args.authorization.requireAuthorized({
      actor: await resolveSocketActor(args.actorPromise),
      action: "task.view",
      resource: {
        kind: "task",
        taskId: topic.id,
      },
    })
    args.socket.join(parsed.room)
    const snapshot = await args.taskQueries.getTaskSnapshot(topic.id)

    emitWebSocketMessage(args.socket, subscribedEnvelope(topic))
    emitTaskMessage(args.socket, topic, snapshot)
  } catch (error) {
    emitInteractionError(args.socket, error, parsed.topic)
  }
}

async function replayTaskEventsSnapshot(args: {
  socket: SocketSessionLike
  taskQueries: Pick<TaskInteractionQueries, "getTaskEventsSnapshot">
  authorization: AuthorizationService
  actorPromise: Promise<AuthorizationActor | null>
  request: InteractionSubscribeRequest
}) {
  const parsed = parseInteractionSubscription(args.request)
  if (!parsed || parsed.topic.kind !== "task-events") {
    emitInteractionError(
      args.socket,
      createInteractionError().invalidTopic("Task-events topic is invalid."),
    )
    return
  }

  try {
    const taskEventsSubscription = parsed as Extract<
      ParsedInteractionSubscription,
      {
        topic: {
          kind: "task-events"
        }
      }
    >
    const topic = parsed.topic
    await args.authorization.requireAuthorized({
      actor: await resolveSocketActor(args.actorPromise),
      action: "task.events.read",
      resource: {
        kind: "task",
        taskId: topic.id,
      },
    })
    args.socket.join(parsed.room)
    const snapshot = await args.taskQueries.getTaskEventsSnapshot({
      taskId: topic.id,
      afterSequence: taskEventsSubscription.afterSequence,
      limit: taskEventsSubscription.limit,
    })

    emitWebSocketMessage(args.socket, subscribedEnvelope(topic))
    emitTaskMessage(args.socket, topic, snapshot)
  } catch (error) {
    emitInteractionError(args.socket, error, parsed.topic)
  }
}

export async function handleProjectGitSubscription(args: {
  socket: Pick<SocketSessionLike, "emit">
  projectGitWatcher: Pick<ProjectGitInteractionWatcher, "subscribe">
  authorization: AuthorizationService
  actorPromise: Promise<AuthorizationActor | null>
  request: InteractionSubscribeRequest
  unsubscribeByTopicKey: Map<string, () => void>
}) {
  const parsed = parseInteractionSubscription(args.request)
  if (!parsed || parsed.topic.kind !== "project-git") {
    emitInteractionError(
      args.socket,
      createInteractionError().invalidTopic("Project-git topic is invalid."),
    )
    return
  }

  try {
    const topic = parsed.topic
    await args.authorization.requireAuthorized({
      actor: await resolveSocketActor(args.actorPromise),
      action: "project.git.subscribe",
      resource: {
        kind: "project",
        projectId: topic.id,
      },
    })
    const topicKey = interactionTopicKey(topic)
    if (!args.unsubscribeByTopicKey.has(topicKey)) {
      const unsubscribe = await args.projectGitWatcher.subscribe(
        topic.id,
        (event) => {
          emitProjectGitChanged(args.socket, topic, event)
        },
      )

      args.unsubscribeByTopicKey.set(topicKey, () => {
        void Promise.resolve(unsubscribe())
      })
    }

    emitWebSocketMessage(args.socket, subscribedEnvelope(topic))
  } catch (error) {
    emitInteractionError(args.socket, error, parsed.topic)
  }
}

async function handleTaskSubscription(args: {
  socket: SocketSessionLike
  actorPromise: Promise<AuthorizationActor | null>
  authorization: AuthorizationService
  taskQueries: TaskInteractionQueries
  taskStream: TaskInteractionStream
  request: InteractionSubscribeRequest
  unsubscribeByTopicKey: Map<string, () => void | Promise<void>>
}) {
  const parsed = parseInteractionSubscription(args.request)
  if (
    !parsed ||
    (parsed.topic.kind !== "task" && parsed.topic.kind !== "task-events")
  ) {
    emitInteractionError(
      args.socket,
      createInteractionError().invalidTopic("Task topic is invalid."),
    )
    return
  }

  try {
    const topic = parsed.topic
    await args.authorization.requireAuthorized({
      actor: await resolveSocketActor(args.actorPromise),
      action: topic.kind === "task" ? "task.view" : "task.events.read",
      resource: {
        kind: "task",
        taskId: topic.id,
      },
    })

    const topicKey = interactionTopicKey(topic)
    if (!args.unsubscribeByTopicKey.has(topicKey)) {
      const subscription = args.taskStream
        .selectTopic(topic)
        .subscribe((message) => {
          emitTaskMessage(args.socket, topic, message)
        })
      args.unsubscribeByTopicKey.set(topicKey, () => subscription.unsubscribe())
    }

    if (topic.kind === "task") {
      await replayTaskSnapshot({
        socket: args.socket,
        authorization: args.authorization,
        actorPromise: args.actorPromise,
        taskQueries: args.taskQueries,
        request: args.request,
      })
      return
    }

    await replayTaskEventsSnapshot({
      socket: args.socket,
      authorization: args.authorization,
      actorPromise: args.actorPromise,
      taskQueries: args.taskQueries,
      request: args.request,
    })
  } catch (error) {
    emitInteractionError(args.socket, error, parsed.topic)
  }
}

export function bindWebSocketSession(args: {
  socket: SocketSessionLike
  actorPromise: Promise<AuthorizationActor | null>
  authorization: AuthorizationService
  taskQueries: TaskInteractionQueries
  taskStream: TaskInteractionStream
  projectGitWatcher: Pick<ProjectGitInteractionWatcher, "subscribe">
}) {
  const taskStreamSubscriptions = new Map<string, () => void | Promise<void>>()
  const projectGitSubscriptions = new Map<string, () => void>()

  args.socket.on("interaction:subscribe", (payload: unknown = {}) => {
    const request = payload as InteractionSubscribeRequest
    const parsed = parseInteractionSubscription(request)

    if (!parsed) {
      emitInteractionError(
        args.socket,
        createInteractionError().invalidTopic("Interaction topic is invalid."),
      )
      return
    }

    const topicKey = interactionTopicKey(parsed.topic)

    switch (parsed.topic.kind) {
      case "project-git":
        void handleProjectGitSubscription({
          socket: args.socket,
          projectGitWatcher: args.projectGitWatcher,
          authorization: args.authorization,
          actorPromise: args.actorPromise,
          request,
          unsubscribeByTopicKey: projectGitSubscriptions,
        })
        return
      case "task":
      case "task-events":
        void handleTaskSubscription({
          socket: args.socket,
          actorPromise: args.actorPromise,
          authorization: args.authorization,
          taskQueries: args.taskQueries,
          taskStream: args.taskStream,
          request,
          unsubscribeByTopicKey: taskStreamSubscriptions,
        })
    }
  })

  args.socket.on("interaction:unsubscribe", (payload: unknown = {}) => {
    const request = payload as InteractionSubscribeRequest
    const parsed = parseInteractionSubscription(request)

    if (!parsed) {
      emitInteractionError(
        args.socket,
        createInteractionError().invalidTopic("Interaction topic is invalid."),
      )
      return
    }

    const topicKey = interactionTopicKey(parsed.topic)
    args.socket.leave(interactionTopicRoom(parsed.topic))

    if (parsed.topic.kind === "project-git") {
      projectGitSubscriptions.get(topicKey)?.()
      projectGitSubscriptions.delete(topicKey)
      emitWebSocketMessage(args.socket, unsubscribedEnvelope(parsed.topic))
      return
    }

    const unsubscribe = taskStreamSubscriptions.get(topicKey)
    if (unsubscribe) {
      void Promise.resolve(unsubscribe())
    }
    taskStreamSubscriptions.delete(topicKey)
    emitWebSocketMessage(args.socket, unsubscribedEnvelope(parsed.topic))
  })

  function disconnect() {
    for (const unsubscribe of taskStreamSubscriptions.values()) {
      void Promise.resolve(unsubscribe())
    }
    for (const unsubscribe of projectGitSubscriptions.values()) {
      unsubscribe()
    }
    taskStreamSubscriptions.clear()
    projectGitSubscriptions.clear()
  }

  args.socket.on("disconnect", disconnect)

  return {
    disconnect,
  }
}
