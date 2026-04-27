import { useMemo } from "react"

import {
  type TaskEffort,
  type TaskExecutionMode,
} from "@/modules/tasks/contracts"
import { useAgentCapabilitiesQuery } from "@/modules/tasks/hooks/use-task-queries"
import { type TaskCreationExecutor, useAppStore } from "@/stores/app.store"

const TASK_CREATION_EXECUTORS: TaskCreationExecutor[] = ["codex", "claude-code"]
const DEFAULT_TASK_EXECUTION_MODE: TaskExecutionMode = "full-access"

function isTaskCreationExecutor(value: string): value is TaskCreationExecutor {
  return TASK_CREATION_EXECUTORS.includes(value as TaskCreationExecutor)
}

function resolveModelSelection(
  models: {
    id: string
    isDefault: boolean
  }[],
  selectedModel: string | null,
) {
  if (selectedModel && models.some((model) => model.id === selectedModel)) {
    return selectedModel
  }

  return models.find((model) => model.isDefault)?.id ?? models[0]?.id ?? null
}

function resolveEffortSelection(
  efforts: readonly TaskEffort[],
  selectedEffort: TaskEffort | null,
) {
  if (selectedEffort && efforts.includes(selectedEffort)) {
    return selectedEffort
  }

  if (efforts.includes("medium")) {
    return "medium"
  }

  return efforts[0] ?? null
}

export function useTaskCreationParams() {
  const agentCapabilitiesQuery = useAgentCapabilitiesQuery()
  const taskCreationDefaults = useAppStore(
    (state) => state.taskCreationDefaults,
  )
  const updateTaskCreationDefaults = useAppStore(
    (state) => state.updateTaskCreationDefaults,
  )
  const resetTaskCreationDefaults = useAppStore(
    (state) => state.resetTaskCreationDefaults,
  )

  const executor = taskCreationDefaults.executor
  const runtimeDefaults = taskCreationDefaults.runtimes[executor]
  const executorCapabilities =
    agentCapabilitiesQuery.data?.agents[executor] ?? null
  const availableModels = useMemo(
    () => executorCapabilities?.models ?? [],
    [executorCapabilities],
  )
  const availableModelIds = useMemo(
    () => new Set(availableModels.map((model) => model.id)),
    [availableModels],
  )

  const model = useMemo(() => {
    if (availableModels.length === 0) {
      return null
    }

    if (runtimeDefaults.model && availableModelIds.has(runtimeDefaults.model)) {
      return runtimeDefaults.model
    }

    return resolveModelSelection(availableModels, runtimeDefaults.model)
  }, [availableModelIds, availableModels, runtimeDefaults.model])

  const resolvedModelConfig = useMemo(() => {
    if (!model) {
      return null
    }

    return availableModels.find((candidate) => candidate.id === model) ?? null
  }, [availableModels, model])

  const availableEfforts = useMemo(
    () => resolvedModelConfig?.efforts ?? [],
    [resolvedModelConfig],
  )

  const effort = useMemo(
    () => resolveEffortSelection(availableEfforts, runtimeDefaults.effort),
    [availableEfforts, runtimeDefaults.effort],
  )

  function setExecutor(nextExecutor: string) {
    if (!isTaskCreationExecutor(nextExecutor)) {
      return
    }

    updateTaskCreationDefaults({
      executor: nextExecutor,
    })
  }

  function setModel(nextModel: string | null) {
    updateTaskCreationDefaults({
      runtimes: {
        [executor]: {
          model: nextModel,
          effort: null,
        },
      },
    })
  }

  function setEffort(nextEffort: TaskEffort) {
    updateTaskCreationDefaults({
      runtimes: {
        [executor]: {
          effort: nextEffort,
        },
      },
    })
  }

  function reset() {
    resetTaskCreationDefaults()
  }

  return {
    executor,
    model,
    effort,
    executionMode: DEFAULT_TASK_EXECUTION_MODE,
    availableModels,
    availableEfforts,
    hasResolvedRuntimeConfig: Boolean(model && effort),
    setExecutor,
    setModel,
    setEffort,
    reset,
  }
}
