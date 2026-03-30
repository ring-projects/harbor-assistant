import {
  AgentFactory,
  type AgentCapabilities,
  type AgentType,
} from "../../../lib/agents"
import { TASK_EFFORT_VALUES, type TaskEffort } from "../domain/task-effort"
import { createTaskError } from "../errors"

function normalizeNullableString(value: string | null | undefined) {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

async function getExecutorCapabilities(input: {
  executor: string
  inspectCapabilities?: (type: AgentType) => Promise<AgentCapabilities>
}) {
  const executor = input.executor.trim()
  if (!AgentFactory.has(executor as AgentType)) {
    throw createTaskError().invalidInput(`executor "${executor}" is not supported`)
  }

  const inspectCapabilities =
    input.inspectCapabilities ??
    ((type: AgentType) => AgentFactory.getCapability(type).inspect())

  return {
    executor,
    capabilities: await inspectCapabilities(executor as AgentType),
  }
}

export async function validateTaskRuntimeConfig(input: {
  executor: string
  model: string | null
  effort: TaskEffort | null
  inspectCapabilities?: (type: AgentType) => Promise<AgentCapabilities>
}): Promise<{
  executor: string
  model: string | null
  effort: TaskEffort | null
}> {
  const { executor, capabilities } = await getExecutorCapabilities(input)
  const modelId = normalizeNullableString(input.model)
  const model = modelId
    ? capabilities.models.find((candidate) => candidate.id === modelId) ?? null
    : null

  if (modelId && !model) {
    throw createTaskError().invalidInput(
      `model "${modelId}" is not available for executor "${executor}"`,
    )
  }

  if (input.effort && !model) {
    throw createTaskError().invalidEffort(
      `effort "${input.effort}" requires an explicit model on executor "${executor}"`,
    )
  }

  if (input.effort && model) {
    const supportedEfforts = model.efforts.filter(
      (effort): effort is TaskEffort =>
        (TASK_EFFORT_VALUES as readonly string[]).includes(effort),
    )

    if (!supportedEfforts.includes(input.effort)) {
      throw createTaskError().invalidEffort(
        `effort "${input.effort}" is not supported by model "${model.id}"`,
      )
    }
  }

  return {
    executor,
    model: modelId,
    effort: input.effort,
  }
}
