import { assertOrchestrationIsActive } from "../domain/orchestration"
import { createOrchestrationError } from "../errors"
import type { OrchestrationRepository } from "./orchestration-repository"
import type { OrchestrationTaskPort } from "./orchestration-task-port"

export async function createOrchestrationTaskUseCase(
  args: {
    repository: Pick<OrchestrationRepository, "findById">
    taskPort: OrchestrationTaskPort
  },
  input: {
    orchestrationId: string
    title?: string
    prompt?: string | null
    items?: Parameters<OrchestrationTaskPort["createTaskForOrchestration"]>[0]["items"]
    executor: string
    model: string
    executionMode: string
    effort: Parameters<OrchestrationTaskPort["createTaskForOrchestration"]>[0]["effort"]
  },
) {
  const orchestrationId = input.orchestrationId.trim()
  if (!orchestrationId) {
    throw createOrchestrationError().invalidInput("orchestrationId is required")
  }

  const orchestration = await args.repository.findById(orchestrationId)
  if (!orchestration) {
    throw createOrchestrationError().notFound()
  }

  assertOrchestrationIsActive(orchestration)

  return args.taskPort.createTaskForOrchestration({
    projectId: orchestration.projectId,
    orchestrationId,
    title: input.title,
    prompt: input.prompt,
    items: input.items,
    executor: input.executor,
    model: input.model,
    executionMode: input.executionMode,
    effort: input.effort,
  })
}
