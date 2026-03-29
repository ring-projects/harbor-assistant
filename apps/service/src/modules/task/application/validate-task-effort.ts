import {
  AgentFactory,
  type AgentCapabilities,
  type AgentType,
} from "../../../lib/agents"
import { TASK_EFFORT_VALUES, type TaskEffort } from "../domain/task-effort"
import { createTaskError } from "../errors"

function findDefaultModel(capabilities: AgentCapabilities) {
  return capabilities.models.find((model) => model.isDefault) ?? null
}

export async function validateTaskEffortSelection(input: {
  executor: string
  model: string | null
  effort: TaskEffort | null
  inspectCapabilities?: (type: AgentType) => Promise<AgentCapabilities>
}): Promise<TaskEffort | null> {
  if (!input.effort) {
    return null
  }

  const executor = input.executor.trim()
  if (!AgentFactory.has(executor as AgentType)) {
    throw createTaskError().invalidEffort(
      `unable to validate effort "${input.effort}" for executor "${executor}"`,
    )
  }

  const inspectCapabilities =
    input.inspectCapabilities ??
    ((type: AgentType) => AgentFactory.getCapability(type).inspect())
  const capabilities = await inspectCapabilities(executor as AgentType)
  const modelId = input.model?.trim() || findDefaultModel(capabilities)?.id || null

  if (!modelId) {
    throw createTaskError().invalidEffort(
      `unable to resolve a model for effort "${input.effort}" on executor "${executor}"`,
    )
  }

  const model = capabilities.models.find((candidate) => candidate.id === modelId)
  if (!model) {
    throw createTaskError().invalidEffort(
      `model "${modelId}" is not available for executor "${executor}"`,
    )
  }

  const supportedEfforts = model.efforts.filter(
    (effort): effort is TaskEffort =>
      (TASK_EFFORT_VALUES as readonly string[]).includes(effort),
  )

  if (!supportedEfforts.includes(input.effort)) {
    throw createTaskError().invalidEffort(
      `effort "${input.effort}" is not supported by model "${model.id}"`,
    )
  }

  return input.effort
}
