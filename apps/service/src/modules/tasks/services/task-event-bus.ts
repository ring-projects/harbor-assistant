import type {
  CodexTask,
  TaskAgentEvent,
  TaskStatus,
} from "../types"

export type TaskStreamEvent =
  | {
      type: "agent_event"
      taskId: string
      event: TaskAgentEvent
    }
  | {
      type: "task_status"
      taskId: string
      status: TaskStatus
    }
  | {
      type: "task_end"
      taskId: string
      status: Extract<TaskStatus, "completed" | "failed" | "cancelled">
      cursor: number
    }
  | {
      type: "task_upsert"
      projectId: string
      task: CodexTask
    }
  | {
      type: "task_deleted"
      projectId: string
      taskId: string
    }

type TaskStreamListener = (event: TaskStreamEvent) => void

export function createTaskEventBus() {
  const listenersByTaskId = new Map<string, Set<TaskStreamListener>>()
  const listenersByProjectId = new Map<string, Set<TaskStreamListener>>()

  function publish(event: TaskStreamEvent) {
    if ("taskId" in event) {
      const taskListeners = listenersByTaskId.get(event.taskId)
      if (taskListeners) {
        for (const listener of taskListeners) {
          listener(event)
        }
      }
    }

    if ("projectId" in event) {
      const projectListeners = listenersByProjectId.get(event.projectId)
      if (projectListeners) {
        for (const listener of projectListeners) {
          listener(event)
        }
      }
    }
  }

  function subscribe(taskId: string, listener: TaskStreamListener) {
    const normalizedTaskId = taskId.trim()
    if (!normalizedTaskId) {
      return () => {}
    }

    const listeners = listenersByTaskId.get(normalizedTaskId) ?? new Set()
    listeners.add(listener)
    listenersByTaskId.set(normalizedTaskId, listeners)

    return () => {
      const currentListeners = listenersByTaskId.get(normalizedTaskId)
      if (!currentListeners) {
        return
      }

      currentListeners.delete(listener)
      if (currentListeners.size === 0) {
        listenersByTaskId.delete(normalizedTaskId)
      }
    }
  }

  function subscribeProject(projectId: string, listener: TaskStreamListener) {
    const normalizedProjectId = projectId.trim()
    if (!normalizedProjectId) {
      return () => {}
    }

    const listeners = listenersByProjectId.get(normalizedProjectId) ?? new Set()
    listeners.add(listener)
    listenersByProjectId.set(normalizedProjectId, listeners)

    return () => {
      const currentListeners = listenersByProjectId.get(normalizedProjectId)
      if (!currentListeners) {
        return
      }

      currentListeners.delete(listener)
      if (currentListeners.size === 0) {
        listenersByProjectId.delete(normalizedProjectId)
      }
    }
  }

  return {
    publish,
    subscribe,
    subscribeProject,
  }
}

export type TaskEventBus = ReturnType<typeof createTaskEventBus>
