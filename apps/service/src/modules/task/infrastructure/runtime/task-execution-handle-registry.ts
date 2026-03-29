export type TaskExecutionHandle = {
  abortController: AbortController
  completion: Promise<void>
  cancelRequestedAt: Date | null
}

export function createTaskExecutionHandleRegistry() {
  const handles = new Map<string, TaskExecutionHandle>()

  return {
    register(taskId: string, handle: TaskExecutionHandle) {
      handles.set(taskId, handle)
    },
    get(taskId: string) {
      return handles.get(taskId) ?? null
    },
    delete(taskId: string, handle?: TaskExecutionHandle) {
      const current = handles.get(taskId)
      if (!current) {
        return
      }

      if (handle && current !== handle) {
        return
      }

      handles.delete(taskId)
    },
  }
}
