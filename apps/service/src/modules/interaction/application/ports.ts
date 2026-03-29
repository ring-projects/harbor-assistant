export type InteractionTopicKind =
  | "project"
  | "task"
  | "task-events"
  | "project-git"

export type InteractionTopic = {
  kind: InteractionTopicKind
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

export type InteractionTaskStreamEvent =
  | {
      type: "agent_event"
      taskId: string
      event: InteractionTaskEventItem
    }
  | {
      type: "task_status"
      taskId: string
      status: InteractionTaskStatus
    }
  | {
      type: "task_end"
      taskId: string
      status: Extract<
        InteractionTaskStatus,
        "completed" | "failed" | "cancelled"
      >
      cursor: number
    }
  | {
      type: "task_upsert"
      projectId: string
      task: InteractionTaskRecord
    }
  | {
      type: "task_deleted"
      projectId: string
      taskId: string
    }

export type InteractionProjectGitChangeEvent = {
  projectId: string
  changedAt: string
}

export interface TaskInteractionQueries {
  listProjectTasks(input: {
    projectId: string
    limit?: number
  }): Promise<InteractionTaskRecord[]>
  getTaskDetail(taskId: string): Promise<InteractionTaskRecord>
  getTaskEvents(input: {
    taskId: string
    afterSequence?: number
    limit?: number
  }): Promise<{
    task: InteractionTaskRecord
    events: InteractionTaskEventStream
    isTerminal: boolean
  }>
}

export interface TaskInteractionSubscriptionHandle {
  unsubscribe(): void | Promise<void>
}

export interface TaskInteractionSubscription {
  subscribe(
    listener: (event: InteractionTaskStreamEvent) => void,
  ): TaskInteractionSubscriptionHandle
}

export interface TaskInteractionStream {
  selectProject(projectId: string): TaskInteractionSubscription
  selectTask(taskId: string): TaskInteractionSubscription
}

export interface ProjectGitInteractionWatcher {
  subscribe(
    projectId: string,
    listener: (event: InteractionProjectGitChangeEvent) => void,
  ): Promise<(() => Promise<void>) | (() => void)>
}

export interface ProjectGitInteractionLifecycle
  extends ProjectGitInteractionWatcher {
  close?(): Promise<void>
}
