import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { TaskEffort, TaskExecutionMode } from "@/modules/tasks/contracts"

export type TaskCreationExecutor = "codex" | "claude-code"

export type TaskCreationRuntimeDefaults = {
  model: string | null
  effort: TaskEffort | null
  executionMode: TaskExecutionMode
}

export type TaskCreationDefaults = {
  executor: TaskCreationExecutor
  runtimes: Record<TaskCreationExecutor, TaskCreationRuntimeDefaults>
}

export type TaskCreationDefaultsPatch = Partial<{
  executor: TaskCreationExecutor
  runtimes: Partial<
    Record<TaskCreationExecutor, Partial<TaskCreationRuntimeDefaults>>
  >
}>

export const DEFAULT_TASK_CREATION_DEFAULTS: TaskCreationDefaults = {
  executor: "codex",
  runtimes: {
    codex: {
      model: null,
      effort: null,
      executionMode: "connected",
    },
    "claude-code": {
      model: null,
      effort: null,
      executionMode: "connected",
    },
  },
}

type AppState = {
  activeProjectId: string | null
  taskCreationDefaults: TaskCreationDefaults
  setActiveProjectId: (projectId: string | null) => void
  clearActiveProjectId: () => void
  updateTaskCreationDefaults: (patch: TaskCreationDefaultsPatch) => void
  resetTaskCreationDefaults: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeProjectId: null,
      taskCreationDefaults: DEFAULT_TASK_CREATION_DEFAULTS,
      setActiveProjectId: (projectId) =>
        set({
          activeProjectId: projectId,
        }),
      clearActiveProjectId: () =>
        set({
          activeProjectId: null,
        }),
      updateTaskCreationDefaults: (patch) =>
        set((state) => ({
          taskCreationDefaults: {
            executor: patch.executor ?? state.taskCreationDefaults.executor,
            runtimes: {
              codex: {
                ...state.taskCreationDefaults.runtimes.codex,
                ...patch.runtimes?.codex,
              },
              "claude-code": {
                ...state.taskCreationDefaults.runtimes["claude-code"],
                ...patch.runtimes?.["claude-code"],
              },
            },
          },
        })),
      resetTaskCreationDefaults: () =>
        set({
          taskCreationDefaults: DEFAULT_TASK_CREATION_DEFAULTS,
        }),
    }),
    {
      name: "harbor-app",
      partialize: (state) => ({
        activeProjectId: state.activeProjectId,
        taskCreationDefaults: state.taskCreationDefaults,
      }),
    },
  ),
)
