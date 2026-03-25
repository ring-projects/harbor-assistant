import type {
  ChatConversationBlock,
  ChatInspectorBlock,
} from "@/modules/tasks/features/task-session/types"
import type {
  TaskAgentEvent,
  TaskAgentEventStream,
  TaskDetail,
  TaskListItem,
  TaskStatus,
} from "@/modules/tasks/contracts"

export type TaskRecord = TaskDetail | TaskListItem

export type PendingPromptState = {
  content: string
  baselineSequence: number
}

export type ChatUiState = {
  draft: string
  pendingPrompt: PendingPromptState | null
  stickToBottom: boolean
  selectedInspectorBlockId: string | null
}

export type TasksSessionState = {
  tasksById: Record<string, TaskDetail>
  taskIdsByProject: Record<string, string[]>
  eventStreamsByTaskId: Record<string, TaskAgentEventStream>
  chatUiByTaskId: Record<string, ChatUiState>
}

export type TasksSessionActions = {
  hydrateProjectTasks: (projectId: string, tasks: TaskListItem[]) => void
  hydrateTaskDetail: (task: TaskDetail) => void
  hydrateTaskEvents: (taskId: string, stream: TaskAgentEventStream) => void
  applyTaskUpsert: (task: TaskRecord) => void
  deleteTask: (projectId: string, taskId: string) => void
  applyTaskStatus: (taskId: string, status: TaskStatus) => void
  applyTaskEnd: (taskId: string, status: TaskStatus) => void
  applyAgentEvent: (taskId: string, event: TaskAgentEvent) => void
  setDraft: (taskId: string, draft: string) => void
  setPendingPrompt: (taskId: string, pendingPrompt: PendingPromptState | null) => void
  setStickToBottom: (taskId: string, stickToBottom: boolean) => void
  setSelectedInspectorBlockId: (
    taskId: string,
    inspectorBlockId: string | null,
  ) => void
}

export type TasksSessionStore = TasksSessionState & TasksSessionActions

export type SelectedInspectorBlock = ChatInspectorBlock
export type TaskConversationBlock = ChatConversationBlock
