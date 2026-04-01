import type {
  InteractionTopic,
  InteractionProjectGitChangeEvent,
  InteractionTaskEventItem,
  InteractionTaskRecord,
  InteractionTaskStatus,
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
    | {
        kind: "snapshot"
        name: "task"
        data: {
          task: InteractionTaskRecord
        }
      }
    | {
        kind: "snapshot"
        name: "task_events"
        data: {
          status: InteractionTaskStatus
          afterSequence: number
          items: InteractionTaskEventItem[]
          nextSequence: number
          terminal: boolean
        }
      }
    | {
        kind: "event"
        name:
          | "task_upsert"
          | "task_deleted"
          | "task_status_changed"
          | "task_ended"
          | "task_event"
          | "project_git_changed"
        data: unknown
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

function messageEnvelope(
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
  return messageEnvelope({
    topic,
    message: {
      kind: "subscribed",
    },
  })
}

export function unsubscribedEnvelope(
  topic: InteractionTopic,
): WebSocketInteractionEnvelope {
  return messageEnvelope({
    topic,
    message: {
      kind: "unsubscribed",
    },
  })
}

export function taskSnapshotEnvelope(args: {
  topic: InteractionTopic
  task: InteractionTaskRecord
}): WebSocketInteractionEnvelope {
  return messageEnvelope({
    topic: args.topic,
    message: {
      kind: "snapshot",
      name: "task",
      data: {
        task: args.task,
      },
    },
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
  return messageEnvelope({
    topic: args.topic,
    message: {
      kind: "snapshot",
      name: "task_events",
      data: {
        status: args.status,
        afterSequence: args.afterSequence,
        items: args.items,
        nextSequence: args.nextSequence,
        terminal: args.terminal,
      },
    },
  })
}

export function taskUpsertEventEnvelope(args: {
  topic: InteractionTopic
  task: InteractionTaskRecord
}): WebSocketInteractionEnvelope {
  return messageEnvelope({
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
  return messageEnvelope({
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
  return messageEnvelope({
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
  return messageEnvelope({
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
  return messageEnvelope({
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
  return messageEnvelope({
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
  return messageEnvelope({
    ...(args.topic ? { topic: args.topic } : {}),
    message: {
      kind: "error",
      error: args.error,
    },
  })
}
