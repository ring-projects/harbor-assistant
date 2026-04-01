import type {
  TaskAgentEvent,
  TaskAgentEventStream,
  TaskDetail,
  TaskListItem,
  TaskStatus,
} from "@/modules/tasks/contracts"
import type {
  TaskInput,
  UploadedTaskInputImage,
} from "@/modules/tasks/lib"

export type TaskRecord = TaskDetail | TaskListItem

export type PendingPromptState = {
  content: string
  baselineSequence: number
  input: TaskInput
}

export type QueuedPromptState = {
  content: string
  input: TaskInput
}

export type ChatUiState = {
  draft: string
  draftAttachments: UploadedTaskInputImage[]
  pendingPrompt: PendingPromptState | null
  queuedPrompt: QueuedPromptState | null
  stickToBottom: boolean
  selectedInspectorBlockId: string | null
}

export type TasksSessionState = {
  tasksById: Record<string, TaskDetail>
  taskIdsByOrchestration: Record<string, string[]>
  eventStreamsByTaskId: Record<string, TaskAgentEventStream>
  chatUiByTaskId: Record<string, ChatUiState>
}

export type TasksSessionActions = {
  hydrateOrchestrationTasks: (
    orchestrationId: string,
    tasks: TaskListItem[],
  ) => void
  hydrateTaskDetail: (task: TaskDetail) => void
  hydrateTaskEvents: (taskId: string, stream: TaskAgentEventStream) => void
  applyTaskUpsert: (task: TaskRecord) => void
  deleteTask: (orchestrationId: string, taskId: string) => void
  applyTaskStatus: (taskId: string, status: TaskStatus) => void
  applyTaskEnd: (taskId: string, status: TaskStatus) => void
  applyAgentEvent: (taskId: string, event: TaskAgentEvent) => void
  setDraft: (taskId: string, draft: string) => void
  setDraftAttachments: (
    taskId: string,
    draftAttachments: UploadedTaskInputImage[],
  ) => void
  setPendingPrompt: (taskId: string, pendingPrompt: PendingPromptState | null) => void
  setQueuedPrompt: (taskId: string, queuedPrompt: QueuedPromptState | null) => void
  setStickToBottom: (taskId: string, stickToBottom: boolean) => void
  setSelectedInspectorBlockId: (
    taskId: string,
    inspectorBlockId: string | null,
  ) => void
}

export type TasksSessionStore = TasksSessionState & TasksSessionActions
