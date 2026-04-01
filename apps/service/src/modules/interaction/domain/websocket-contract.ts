import type {
  InteractionProjectGitChangeEvent,
  InteractionTaskEventItem,
  InteractionTaskEventsSnapshotMessage,
  InteractionTaskMessage,
  InteractionTaskRecord,
  InteractionTaskSnapshotMessage,
  InteractionTaskStatus,
  InteractionTopic,
} from "../application/ports"
import type { InteractionMessageError } from "../errors"

export type WebSocketInteractionEnvelope = {
  event: "interaction:message"
  payload: WebSocketInteractionMessage
}

export type WebSocketInteractionMessage = {
  topic?: InteractionTopic
  message:
    | {
        kind: "subscribed"
      }
    | {
        kind: "unsubscribed"
      }
    | InteractionTaskMessage
    | {
        kind: "event"
        name: "project_git_changed"
        data: Pick<InteractionProjectGitChangeEvent, "changedAt">
      }
    | {
        kind: "error"
        error: InteractionMessageError
      }
}

export function emitWebSocketMessage(
  socket: Pick<{ emit(event: string, payload: unknown): void }, "emit">,
  envelope: WebSocketInteractionEnvelope,
) {
  socket.emit(envelope.event, envelope.payload)
}

export function interactionMessageEnvelope(
  payload: WebSocketInteractionMessage,
): WebSocketInteractionEnvelope {
  return {
    event: "interaction:message",
    payload,
  }
}

export function subscribedEnvelope(
  topic: InteractionTopic,
): WebSocketInteractionEnvelope {
  return interactionMessageEnvelope({
    topic,
    message: {
      kind: "subscribed",
    },
  })
}

export function unsubscribedEnvelope(
  topic: InteractionTopic,
): WebSocketInteractionEnvelope {
  return interactionMessageEnvelope({
    topic,
    message: {
      kind: "unsubscribed",
    },
  })
}

function taskMessageEnvelope(args: {
  topic: InteractionTopic
  message: InteractionTaskMessage
}): WebSocketInteractionEnvelope {
  return interactionMessageEnvelope({
    topic: args.topic,
    message: args.message,
  })
}

export function taskSnapshotEnvelope(args: {
  topic: InteractionTopic
  task: InteractionTaskRecord
}): WebSocketInteractionEnvelope {
  const message: InteractionTaskSnapshotMessage = {
    kind: "snapshot",
    name: "task",
    data: {
      task: args.task,
    },
  }

  return taskMessageEnvelope({
    topic: args.topic,
    message,
  })
}

export function taskEventsSnapshotEnvelope(args: {
  topic: InteractionTopic
  status: InteractionTaskStatus
  afterSequence: number
  items: InteractionTaskEventItem[]
  nextSequence: number
  terminal: boolean
}): WebSocketInteractionEnvelope {
  const message: InteractionTaskEventsSnapshotMessage = {
    kind: "snapshot",
    name: "task_events",
    data: {
      status: args.status,
      afterSequence: args.afterSequence,
      items: args.items,
      nextSequence: args.nextSequence,
      terminal: args.terminal,
    },
  }

  return taskMessageEnvelope({
    topic: args.topic,
    message,
  })
}

export function taskUpsertEventEnvelope(args: {
  topic: InteractionTopic
  task: InteractionTaskRecord
}): WebSocketInteractionEnvelope {
  return taskMessageEnvelope({
    topic: args.topic,
    message: {
      kind: "event",
      name: "task_upsert",
      data: {
        task: args.task,
      },
    },
  })
}

export function taskDeletedEventEnvelope(args: {
  topic: InteractionTopic
  taskId: string
  projectId?: string
  orchestrationId?: string
}): WebSocketInteractionEnvelope {
  return taskMessageEnvelope({
    topic: args.topic,
    message: {
      kind: "event",
      name: "task_deleted",
      data: {
        taskId: args.taskId,
        ...(args.projectId ? { projectId: args.projectId } : {}),
        ...(args.orchestrationId
          ? { orchestrationId: args.orchestrationId }
          : {}),
      },
    },
  })
}

export function taskStatusChangedEventEnvelope(args: {
  topic: InteractionTopic
  status: InteractionTaskStatus
}): WebSocketInteractionEnvelope {
  return taskMessageEnvelope({
    topic: args.topic,
    message: {
      kind: "event",
      name: "task_status_changed",
      data: {
        status: args.status,
      },
    },
  })
}

export function taskEndedEventEnvelope(args: {
  topic: InteractionTopic
  status: Extract<InteractionTaskStatus, "completed" | "failed" | "cancelled">
  cursor: number
}): WebSocketInteractionEnvelope {
  return taskMessageEnvelope({
    topic: args.topic,
    message: {
      kind: "event",
      name: "task_ended",
      data: {
        status: args.status,
        cursor: args.cursor,
      },
    },
  })
}

export function taskEventEnvelope(args: {
  topic: InteractionTopic
  event: InteractionTaskEventItem
}): WebSocketInteractionEnvelope {
  return taskMessageEnvelope({
    topic: args.topic,
    message: {
      kind: "event",
      name: "task_event",
      data: {
        event: args.event,
      },
    },
  })
}

export function projectGitChangedEventEnvelope(args: {
  topic: InteractionTopic
  changedAt: string
}): WebSocketInteractionEnvelope {
  return interactionMessageEnvelope({
    topic: args.topic,
    message: {
      kind: "event",
      name: "project_git_changed",
      data: {
        changedAt: args.changedAt,
      },
    },
  })
}

export function errorEnvelope(args: {
  topic?: InteractionTopic
  error: InteractionMessageError
}): WebSocketInteractionEnvelope {
  return interactionMessageEnvelope({
    ...(args.topic ? { topic: args.topic } : {}),
    message: {
      kind: "error",
      error: args.error,
    },
  })
}
