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
} from "./task-event-stream.utils"

import type {
  ChatUiState,
  TaskRecord,
  TasksSessionState,
  TasksSessionStore,
} from "./tasks-session.types"

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
    stickToBottom: true,
    selectedExecutionBlockId: null,
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
    nextTask.exitCode = null
    nextTask.error = null
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
    merged.exitCode = existing.exitCode
    merged.error = existing.error
    merged.stdout = existing.stdout
    merged.stderr = existing.stderr
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

    return (
      new Date(rightCreatedAt).getTime() - new Date(leftCreatedAt).getTime()
    )
  })
}

function reconcilePendingPrompt(
  chatUi: ChatUiState | undefined,
  stream: TaskAgentEventStream | undefined,
) {
  if (!chatUi?.pendingPrompt || !stream) {
    return chatUi ?? createDefaultChatUiState()
  }

  const matchedUserMessage = stream.items.some(
    (event) =>
      event.sequence > chatUi.pendingPrompt!.baselineSequence &&
      event.eventType === "message" &&
      event.payload.role === "user" &&
      typeof event.payload.content === "string" &&
      event.payload.content.trim() === chatUi.pendingPrompt!.content.trim(),
  )

  if (!matchedUserMessage) {
    return chatUi
  }

  return {
    ...chatUi,
    pendingPrompt: null,
  }
}

function setChatUiField(
  state: TasksSessionState,
  taskId: string,
  patch: Partial<ChatUiState>,
) {
  const existing = state.chatUiByTaskId[taskId] ?? createDefaultChatUiState()
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

      const existingTaskIds = state.taskIdsByProject[normalizedProjectId] ?? []
      const nextTaskIds = sortTaskIdsByCreatedAt(
        [...existingTaskIds, ...tasks.map((task) => task.taskId)],
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
      const nextChatUi = reconcilePendingPrompt(
        state.chatUiByTaskId[normalizedTaskId],
        nextStream,
      )

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

    set((state) => ({
      chatUiByTaskId: setChatUiField(state, normalizedTaskId, {
        draft,
      }),
    }))
  },

  setPendingPrompt(taskId, pendingPrompt) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => ({
      chatUiByTaskId: setChatUiField(state, normalizedTaskId, {
        pendingPrompt,
      }),
    }))
  },

  setStickToBottom(taskId, stickToBottom) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => ({
      chatUiByTaskId: setChatUiField(state, normalizedTaskId, {
        stickToBottom,
      }),
    }))
  },

  setSelectedExecutionBlockId(taskId, selectedExecutionBlockId) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return
    }

    set((state) => ({
      chatUiByTaskId: setChatUiField(state, normalizedTaskId, {
        selectedExecutionBlockId,
      }),
    }))
  },
})

export const useTasksSessionStore = create<TasksSessionStore>()(
  createTasksSessionStoreState,
)
