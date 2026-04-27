export type InteractionTopicKind = "task" | "task-events" | "project-git"

export type InteractionTopic =
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

export type InteractionTaskTopic =
  | {
      kind: "task"
      id: string
    }
  | {
      kind: "task-events"
      id: string
    }

export type InteractionSubscribeRequest = {
  topic: InteractionTopic
  afterSequence?: number
  limit?: number
}

export type InteractionTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type InteractionTaskRecord = {
  id: string
  projectId: string
  orchestrationId: string
  prompt?: string
  title: string
  titleSource: "prompt" | "agent" | "user"
  executor: string | null
  model: string | null
  executionMode: string | null
  effort: string | null
  status: InteractionTaskStatus
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  finishedAt: string | null
}

export type InteractionTaskEventItem = {
  id: string
  taskId: string
  sequence: number
  eventType: string
  payload: Record<string, unknown>
  createdAt: string
}

export type InteractionTaskEventStream = {
  taskId: string
  items: InteractionTaskEventItem[]
  nextSequence: number
}

export type InteractionTaskSnapshotMessage = {
  kind: "snapshot"
  name: "task"
  data: {
    task: InteractionTaskRecord
  }
}

export type InteractionTaskEventsSnapshotMessage = {
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

export type InteractionTaskStreamMessage =
  | {
      kind: "event"
      name: "task_upsert"
      data: {
        task: InteractionTaskRecord
      }
    }
  | {
      kind: "event"
      name: "task_deleted"
      data: {
        taskId: string
        projectId?: string
        orchestrationId?: string
      }
    }
  | {
      kind: "event"
      name: "task_status_changed"
      data: {
        status: InteractionTaskStatus
      }
    }
  | {
      kind: "event"
      name: "task_ended"
      data: {
        status: Extract<
          InteractionTaskStatus,
          "completed" | "failed" | "cancelled"
        >
        cursor: number
      }
    }
  | {
      kind: "event"
      name: "task_event"
      data: {
        event: InteractionTaskEventItem
      }
    }

export type InteractionTaskMessage =
  | InteractionTaskSnapshotMessage
  | InteractionTaskEventsSnapshotMessage
  | InteractionTaskStreamMessage

export type InteractionProjectGitChangeEvent = {
  projectId: string
  changedAt: string
}

export interface TaskInteractionQueries {
  getTaskSnapshot(taskId: string): Promise<InteractionTaskSnapshotMessage>
  getTaskEventsSnapshot(input: {
    taskId: string
    afterSequence?: number
    limit?: number
  }): Promise<InteractionTaskEventsSnapshotMessage>
}

export interface TaskInteractionSubscriptionHandle {
  unsubscribe(): void | Promise<void>
}

export interface TaskInteractionSubscription {
  subscribe(
    listener: (message: InteractionTaskStreamMessage) => void,
  ): TaskInteractionSubscriptionHandle
}

export interface TaskInteractionStream {
  selectTopic(topic: InteractionTaskTopic): TaskInteractionSubscription
}

export interface ProjectGitInteractionWatcher {
  subscribe(
    projectId: string,
    listener: (event: InteractionProjectGitChangeEvent) => void,
  ): Promise<(() => Promise<void>) | (() => void)>
}

export interface ProjectGitInteractionLifecycle extends ProjectGitInteractionWatcher {
  close?(): Promise<void>
}
