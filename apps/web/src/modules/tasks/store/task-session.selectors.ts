import type { TaskAgentEvent } from "@/modules/tasks/contracts"

import type {
  ChatUiState,
  TaskRecord,
  TasksSessionState,
} from "./task-session.types"

const DEFAULT_CHAT_UI: ChatUiState = {
  draft: "",
  draftAttachments: [],
  pendingPrompt: null,
  queuedPrompt: null,
  stickToBottom: true,
  selectedInspectorBlockId: null,
}

const EMPTY_ORCHESTRATION_TASKS: TaskRecord[] = []
const EMPTY_TASK_EVENTS: TaskAgentEvent[] = []

const orchestrationTasksCache = new Map<
  string,
  {
    taskIds: string[]
    tasksById: TasksSessionState["tasksById"]
    result: TaskRecord[]
  }
>()

export function selectOrchestrationTasks(
  state: TasksSessionState,
  orchestrationId: string,
) {
  const taskIds = state.taskIdsByOrchestration[orchestrationId] ?? []
  if (taskIds.length === 0) {
    return EMPTY_ORCHESTRATION_TASKS
  }

  const cached = orchestrationTasksCache.get(orchestrationId)
  if (
    cached &&
    cached.taskIds === taskIds &&
    cached.tasksById === state.tasksById
  ) {
    return cached.result
  }

  const result = taskIds
    .map((taskId) => state.tasksById[taskId])
    .filter((task): task is NonNullable<typeof task> => Boolean(task))

  orchestrationTasksCache.set(orchestrationId, {
    taskIds,
    tasksById: state.tasksById,
    result,
  })

  return result
}

export function selectTaskDetail(
  state: TasksSessionState,
  taskId: string | null,
) {
  if (!taskId) {
    return null
  }

  return state.tasksById[taskId] ?? null
}

export function selectTaskEventStream(
  state: TasksSessionState,
  taskId: string | null,
) {
  if (!taskId) {
    return null
  }

  return state.eventStreamsByTaskId[taskId] ?? null
}

export function selectTaskEvents(
  state: TasksSessionState,
  taskId: string | null,
) {
  return selectTaskEventStream(state, taskId)?.items ?? EMPTY_TASK_EVENTS
}

export function selectChatUi(state: TasksSessionState, taskId: string | null) {
  if (!taskId) {
    return DEFAULT_CHAT_UI
  }

  return state.chatUiByTaskId[taskId] ?? DEFAULT_CHAT_UI
}

export function selectLastSequence(
  state: TasksSessionState,
  taskId: string | null,
) {
  return selectTaskEvents(state, taskId).at(-1)?.sequence ?? 0
}

export function selectVisiblePendingPrompt(
  state: TasksSessionState,
  taskId: string | null,
) {
  return selectChatUi(state, taskId).pendingPrompt
}
