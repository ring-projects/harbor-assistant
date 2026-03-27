import { create, type StateCreator } from "zustand"

import type {
  TaskAgentEvent,
  TaskAgentEventStream,
  TaskDetail,
  TaskStatus,
} from "@/modules/tasks/contracts"
import {
  mergeTaskAgentEvent,
  mergeTaskEventStreams,
} from "@/modules/tasks/store/task-event-stream.utils"

import type {
  ChatUiState,
  TaskRecord,
  TasksSessionState,
  TasksSessionStore,
} from "./task-session.types"

const TASK_STATUS_PRIORITY: Record<TaskStatus, number> = {
  queued: 0,
  running: 1,
  completed: 2,
  failed: 2,
  cancelled: 2,
}

function createDefaultChatUiState(): ChatUiState {
  return {
    draft: "",
    pendingPrompt: null,
    queuedPrompt: null,
    stickToBottom: true,
    selectedInspectorBlockId: null,
  }
}

function patchTaskStatus(task: TaskDetail, status: TaskStatus): TaskDetail {
  const nextTask: TaskDetail = {
    ...task,
    status,
  }

  if (status === "running" && !task.startedAt) {
    nextTask.startedAt = new Date().toISOString()
    nextTask.finishedAt = null
  }

  if (status === "completed" || status === "failed" || status === "cancelled") {
    nextTask.finishedAt = task.finishedAt ?? new Date().toISOString()
  }

  return nextTask
}

function mergeTaskRecord(
  existing: TaskDetail | undefined,
  incoming: TaskRecord,
): TaskDetail {
  if (!existing) {
    return { ...incoming }
  }

  const merged: TaskDetail = {
    ...existing,
    ...incoming,
  }

  if (TASK_STATUS_PRIORITY[existing.status] > TASK_STATUS_PRIORITY[incoming.status]) {
    merged.status = existing.status
    merged.startedAt = existing.startedAt
    merged.finishedAt = existing.finishedAt
  }

  return merged
}

function sortTaskIdsByCreatedAt(
  taskIds: Iterable<string>,
  tasksById: Record<string, TaskDetail>,
) {
  return [...new Set(taskIds)].sort((left, right) => {
    const leftCreatedAt = tasksById[left]?.createdAt ?? ""
    const rightCreatedAt = tasksById[right]?.createdAt ?? ""

    return new Date(rightCreatedAt).getTime() - new Date(leftCreatedAt).getTime()
  })
}

function removeTaskId(taskIds: string[] | undefined, taskId: string) {
  if (!taskIds || taskIds.length === 0) {
    return []
  }

  return taskIds.filter((currentTaskId) => currentTaskId !== taskId)
}

function reconcilePendingPrompt(
  chatUi: ChatUiState | undefined,
  stream: TaskAgentEventStream | undefined,
) {
  if (!chatUi?.pendingPrompt || !stream) {
    return chatUi ?? createDefaultChatUiState()
  }

  const matchedUserMessage = stream.items.some(
    (event) => matchesPendingPromptEvent(chatUi.pendingPrompt, event),
  )

  if (!matchedUserMessage) {
    return chatUi
  }

  return {
    ...chatUi,
    pendingPrompt: null,
  }
}

function matchesPendingPromptEvent(
  pendingPrompt: ChatUiState["pendingPrompt"] | null | undefined,
  event: TaskAgentEvent,
) {
  if (!pendingPrompt) {
    return false
  }

  return (
    event.sequence > pendingPrompt.baselineSequence &&
    event.eventType === "message" &&
    event.payload.role === "user" &&
    typeof event.payload.content === "string" &&
    event.payload.content.trim() === pendingPrompt.content.trim()
  )
}

function setChatUiField(
  state: TasksSessionState,
  taskId: string,
  patch: Partial<ChatUiState>,
) {
  const existing = state.chatUiByTaskId[taskId] ?? createDefaultChatUiState()

  let changed = false
  for (const [key, value] of Object.entries(patch) as [
    keyof ChatUiState,
    ChatUiState[keyof ChatUiState],
  ][]) {
    if (!Object.is(existing[key], value)) {
      changed = true
      break
    }
  }

  if (!changed) {
    return state.chatUiByTaskId
  }

  return {
    ...state.chatUiByTaskId,
    [taskId]: {
      ...existing,
      ...patch,
    },
  }
}

export const createTasksSessionStoreState: StateCreator<TasksSessionStore> = (
  set,
  get,
) => ({
  tasksById: {},
  taskIdsByProject: {},
  eventStreamsByTaskId: {},
  chatUiByTaskId: {},

  hydrateProjectTasks(projectId, tasks) {
    const normalizedProjectId = projectId.trim()
    if (!normalizedProjectId) {
      return
    }

    set((state) => {
      const tasksById = { ...state.tasksById }

      for (const task of tasks) {
        tasksById[task.taskId] = mergeTaskRecord(tasksById[task.taskId], task)
      }

      const nextTaskIds = sortTaskIdsByCreatedAt(
        tasks.map((task) => task.taskId),
        tasksById,
      )

      return {
        tasksById,
        taskIdsByProject: {
          ...state.taskIdsByProject,
          [normalizedProjectId]: nextTaskIds,
        },
      }
    })
  },

  hydrateTaskDetail(task) {
    get().applyTaskUpsert(task)
  },

  hydrateTaskEvents(taskId, stream) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => {
      const nextStream = mergeTaskEventStreams(
        state.eventStreamsByTaskId[normalizedTaskId],
        stream,
      )

      const nextChatUi = reconcilePendingPrompt(
        state.chatUiByTaskId[normalizedTaskId],
        nextStream ?? undefined,
      )

      return {
        eventStreamsByTaskId: nextStream
          ? {
              ...state.eventStreamsByTaskId,
              [normalizedTaskId]: nextStream,
            }
          : state.eventStreamsByTaskId,
        chatUiByTaskId: {
          ...state.chatUiByTaskId,
          [normalizedTaskId]: nextChatUi,
        },
      }
    })
  },

  applyTaskUpsert(task) {
    const normalizedTaskId = task.taskId.trim()
    const normalizedProjectId = task.projectId.trim()
    if (!normalizedTaskId || !normalizedProjectId) {
      return
    }

    set((state) => {
      const tasksById = {
        ...state.tasksById,
        [normalizedTaskId]: mergeTaskRecord(state.tasksById[normalizedTaskId], task),
      }

      const nextTaskIds = sortTaskIdsByCreatedAt(
        [...(state.taskIdsByProject[normalizedProjectId] ?? []), normalizedTaskId],
        tasksById,
      )

      return {
        tasksById,
        taskIdsByProject: {
          ...state.taskIdsByProject,
          [normalizedProjectId]: nextTaskIds,
        },
      }
    })
  },

  deleteTask(projectId, taskId) {
    const normalizedProjectId = projectId.trim()
    const normalizedTaskId = taskId.trim()
    if (!normalizedProjectId || !normalizedTaskId) {
      return
    }

    set((state) => {
      const tasksById = { ...state.tasksById }
      const eventStreamsByTaskId = { ...state.eventStreamsByTaskId }
      const chatUiByTaskId = { ...state.chatUiByTaskId }

      delete tasksById[normalizedTaskId]
      delete eventStreamsByTaskId[normalizedTaskId]
      delete chatUiByTaskId[normalizedTaskId]

      return {
        tasksById,
        eventStreamsByTaskId,
        chatUiByTaskId,
        taskIdsByProject: {
          ...state.taskIdsByProject,
          [normalizedProjectId]: removeTaskId(
            state.taskIdsByProject[normalizedProjectId],
            normalizedTaskId,
          ),
        },
      }
    })
  },

  applyTaskStatus(taskId, status) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => {
      const existing = state.tasksById[normalizedTaskId]
      if (!existing) {
        return state
      }

      return {
        tasksById: {
          ...state.tasksById,
          [normalizedTaskId]: patchTaskStatus(existing, status),
        },
      }
    })
  },

  applyTaskEnd(taskId, status) {
    get().applyTaskStatus(taskId, status)
  },

  applyAgentEvent(taskId, event) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => {
      const nextStream = mergeTaskAgentEvent(
        state.eventStreamsByTaskId[normalizedTaskId],
        event,
      )
      const currentChatUi = state.chatUiByTaskId[normalizedTaskId]
      const nextChatUi = matchesPendingPromptEvent(
        currentChatUi?.pendingPrompt,
        event,
      )
        ? {
            ...(currentChatUi ?? createDefaultChatUiState()),
            pendingPrompt: null,
          }
        : currentChatUi ?? createDefaultChatUiState()

      return {
        eventStreamsByTaskId: {
          ...state.eventStreamsByTaskId,
          [normalizedTaskId]: nextStream,
        },
        chatUiByTaskId: {
          ...state.chatUiByTaskId,
          [normalizedTaskId]: nextChatUi,
        },
      }
    })
  },

  setDraft(taskId, draft) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => {
      const chatUiByTaskId = setChatUiField(state, normalizedTaskId, {
        draft,
      })

      if (chatUiByTaskId === state.chatUiByTaskId) {
        return state
      }

      return {
        chatUiByTaskId,
      }
    })
  },

  setPendingPrompt(taskId, pendingPrompt) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => {
      const chatUiByTaskId = setChatUiField(state, normalizedTaskId, {
        pendingPrompt,
      })

      if (chatUiByTaskId === state.chatUiByTaskId) {
        return state
      }

      return {
        chatUiByTaskId,
      }
    })
  },

  setQueuedPrompt(taskId, queuedPrompt) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => {
      const chatUiByTaskId = setChatUiField(state, normalizedTaskId, {
        queuedPrompt,
      })

      if (chatUiByTaskId === state.chatUiByTaskId) {
        return state
      }

      return {
        chatUiByTaskId,
      }
    })
  },

  setStickToBottom(taskId, stickToBottom) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => {
      const chatUiByTaskId = setChatUiField(state, normalizedTaskId, {
        stickToBottom,
      })

      if (chatUiByTaskId === state.chatUiByTaskId) {
        return state
      }

      return {
        chatUiByTaskId,
      }
    })
  },

  setSelectedInspectorBlockId(taskId, selectedInspectorBlockId) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => {
      const chatUiByTaskId = setChatUiField(state, normalizedTaskId, {
        selectedInspectorBlockId,
      })

      if (chatUiByTaskId === state.chatUiByTaskId) {
        return state
      }

      return {
        chatUiByTaskId,
      }
    })
  },
})

export const useTasksSessionStore = create<TasksSessionStore>()(
  createTasksSessionStoreState,
)
