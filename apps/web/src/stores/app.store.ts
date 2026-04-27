import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { TaskEffort } from "@/modules/tasks/contracts"

export type TaskCreationExecutor = "codex" | "claude-code"

export type TaskCreationRuntimeDefaults = {
  model: string | null
  effort: TaskEffort | null
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
    },
    "claude-code": {
      model: null,
      effort: null,
    },
  },
}

type AppState = {
  activeWorkspaceId: string | null
  activeProjectId: string | null
  taskCreationDefaults: TaskCreationDefaults
  setActiveWorkspaceId: (workspaceId: string | null) => void
  clearActiveWorkspaceId: () => void
  setActiveProjectId: (projectId: string | null) => void
  clearActiveProjectId: () => void
  updateTaskCreationDefaults: (patch: TaskCreationDefaultsPatch) => void
  resetTaskCreationDefaults: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      activeProjectId: null,
      taskCreationDefaults: DEFAULT_TASK_CREATION_DEFAULTS,
      setActiveWorkspaceId: (workspaceId) =>
        set({
          activeWorkspaceId: workspaceId,
        }),
      clearActiveWorkspaceId: () =>
        set({
          activeWorkspaceId: null,
        }),
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
        activeWorkspaceId: state.activeWorkspaceId,
        activeProjectId: state.activeProjectId,
        taskCreationDefaults: state.taskCreationDefaults,
      }),
    },
  ),
)
