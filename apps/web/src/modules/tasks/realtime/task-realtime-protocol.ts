export type InteractionTopic =
  | {
      kind: "project"
      id: string
    }
  | {
      kind: "task"
      id: string
    }
  | {
      kind: "task-events"
      id: string
    }
  | {
      kind: "project-git"
      id: string
    }

export type InteractionSubscribeRequest = {
  topic: InteractionTopic
  afterSequence?: number
  limit?: number
}

export type InteractionSnapshotMessage = {
  kind: "snapshot"
  name: "project_tasks" | "task" | "task_events"
  data?: Record<string, unknown>
}

export type InteractionEventMessage = {
  kind: "event"
  name:
    | "task_upsert"
    | "task_deleted"
    | "task_status_changed"
    | "task_ended"
    | "task_event"
    | "project_git_changed"
  data?: Record<string, unknown>
}

export type InteractionMessageEnvelope =
  | {
      topic?: InteractionTopic
      message?: {
        kind: "subscribed" | "unsubscribed"
      }
    }
  | {
      topic?: InteractionTopic
      message?: InteractionSnapshotMessage
    }
  | {
      topic?: InteractionTopic
      message?: InteractionEventMessage
    }
  | {
      topic?: InteractionTopic
      message?: {
        kind: "error"
        error?: {
          code?: string
          message?: string
        }
      }
    }
