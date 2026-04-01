import type {
  InteractionProjectGitChangeEvent,
  InteractionSubscribeRequest,
  InteractionTaskStatus,
  InteractionTaskStreamEvent,
  InteractionTopic,
  ProjectGitInteractionWatcher,
  TaskInteractionQueries,
  TaskInteractionStream,
} from "../application/ports"
import {
  interactionTopicKey,
  interactionTopicRoom,
  parseInteractionSubscription,
} from "../domain/subscription-topics"
import {
  emitWebSocketMessage,
  errorEnvelope,
  projectGitChangedEventEnvelope,
  subscribedEnvelope,
  taskDeletedEventEnvelope,
  taskEndedEventEnvelope,
  taskEventEnvelope,
  taskEventsSnapshotEnvelope,
  taskSnapshotEnvelope,
  taskStatusChangedEventEnvelope,
  taskUpsertEventEnvelope,
  unsubscribedEnvelope,
} from "../domain/websocket-contract"
import {
  createInteractionError,
  toInteractionMessageError,
} from "../errors"

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

function emitTaskStreamEvent(
  socket: Pick<SocketSessionLike, "emit">,
  topic: InteractionTopic,
  event: InteractionTaskStreamEvent,
) {
  switch (event.type) {
    case "task_upsert":
      emitWebSocketMessage(
        socket,
        taskUpsertEventEnvelope({
          topic,
          task: event.task,
        }),
      )
      return
    case "task_status":
      emitWebSocketMessage(
        socket,
        taskStatusChangedEventEnvelope({
          topic,
          status: event.status,
        }),
      )
      return
    case "task_end":
      emitWebSocketMessage(
        socket,
        taskEndedEventEnvelope({
          topic,
          status: event.status,
          cursor: event.cursor,
        }),
      )
      return
    case "agent_event":
      emitWebSocketMessage(
        socket,
        taskEventEnvelope({
          topic,
          event: event.event,
        }),
      )
      return
    case "task_deleted":
      return
  }
}

function emitTaskDeleted(
  socket: Pick<SocketSessionLike, "emit">,
  topic: InteractionTopic,
  event: {
    taskId: string
    projectId: string
  },
) {
  emitWebSocketMessage(
    socket,
    taskDeletedEventEnvelope({
      topic,
      taskId: event.taskId,
      projectId: event.projectId,
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

async function replayTaskSnapshot(args: {
  socket: SocketSessionLike
  taskQueries: Pick<TaskInteractionQueries, "getTaskDetail">
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
    args.socket.join(parsed.room)
    const task = await args.taskQueries.getTaskDetail(topic.id)

    emitWebSocketMessage(args.socket, subscribedEnvelope(topic))
    emitWebSocketMessage(
      args.socket,
      taskSnapshotEnvelope({
        topic,
        task,
      }),
    )
  } catch (error) {
    emitInteractionError(args.socket, error, parsed.topic)
  }
}

async function replayTaskEventsSnapshot(args: {
  socket: SocketSessionLike
  taskQueries: Pick<TaskInteractionQueries, "getTaskEvents">
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
    const taskEventsSubscription = parsed as {
      topic: InteractionTopic & {
        kind: "task-events"
      }
      room: string
      afterSequence: number
      limit: number
    }
    const topic = taskEventsSubscription.topic
    args.socket.join(taskEventsSubscription.room)
    const { task, events, isTerminal } = await args.taskQueries.getTaskEvents({
      taskId: topic.id,
      afterSequence: taskEventsSubscription.afterSequence,
      limit: taskEventsSubscription.limit,
    })

    emitWebSocketMessage(args.socket, subscribedEnvelope(topic))
    emitWebSocketMessage(
      args.socket,
      taskEventsSnapshotEnvelope({
        topic,
        status: task.status,
        afterSequence: taskEventsSubscription.afterSequence,
        items: events.items,
        nextSequence: events.nextSequence,
        terminal: isTerminal,
      }),
    )
  } catch (error) {
    emitInteractionError(args.socket, error, parsed.topic)
  }
}

export async function handleProjectGitSubscription(args: {
  socket: Pick<SocketSessionLike, "emit">
  projectGitWatcher: Pick<ProjectGitInteractionWatcher, "subscribe">
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
    const topicKey = interactionTopicKey(topic)
    if (!args.unsubscribeByTopicKey.has(topicKey)) {
      const unsubscribe = await args.projectGitWatcher.subscribe(topic.id, (event) => {
        emitProjectGitChanged(args.socket, topic, event)
      })

      args.unsubscribeByTopicKey.set(topicKey, () => {
        void Promise.resolve(unsubscribe())
      })
    }

    emitWebSocketMessage(args.socket, subscribedEnvelope(topic))
  } catch (error) {
    emitInteractionError(args.socket, error, parsed.topic)
  }
}

export function bindWebSocketSession(args: {
  socket: SocketSessionLike
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
          request,
          unsubscribeByTopicKey: projectGitSubscriptions,
        })
        return
      case "task":
        if (!taskStreamSubscriptions.has(topicKey)) {
          const subscription = args.taskStream
            .selectTask(parsed.topic.id)
            .subscribe((event) => {
              if (event.type === "task_status" || event.type === "task_end") {
                emitTaskStreamEvent(args.socket, parsed.topic, event)
                return
              }

              if (event.type === "task_deleted") {
                emitTaskDeleted(args.socket, parsed.topic, event)
              }
            })
          taskStreamSubscriptions.set(topicKey, () => subscription.unsubscribe())
        }

        void replayTaskSnapshot({
          socket: args.socket,
          taskQueries: args.taskQueries,
          request,
        })
        return
      case "task-events":
        if (!taskStreamSubscriptions.has(topicKey)) {
          const subscription = args.taskStream
            .selectTask(parsed.topic.id)
            .subscribe((event) => {
              if (event.type === "agent_event" || event.type === "task_end") {
                emitTaskStreamEvent(args.socket, parsed.topic, event)
                return
              }

              if (event.type === "task_deleted") {
                emitTaskDeleted(args.socket, parsed.topic, event)
              }
            })
          taskStreamSubscriptions.set(topicKey, () => subscription.unsubscribe())
        }

        void replayTaskEventsSnapshot({
          socket: args.socket,
          taskQueries: args.taskQueries,
          request,
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
