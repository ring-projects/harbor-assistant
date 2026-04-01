import { createOrchestrationError } from "../errors"

export type OrchestrationStatus = "active" | "paused" | "archived"

export type Orchestration = {
  id: string
  projectId: string
  title: string
  description: string | null
  initPrompt: string | null
  config: Record<string, unknown> | null
  status: OrchestrationStatus
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export function createOrchestration(input: {
  id: string
  projectId: string
  title: string
  description?: string | null
  initPrompt?: string | null
  config?: Record<string, unknown> | null
  status?: OrchestrationStatus
  archivedAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}): Orchestration {
  const id = input.id.trim()
  const projectId = input.projectId.trim()
  const title = input.title.trim()
  const createdAt = input.createdAt ?? new Date()
  const updatedAt = input.updatedAt ?? createdAt

  if (!id) {
    throw createOrchestrationError().invalidInput("id is required")
  }
  if (!projectId) {
    throw createOrchestrationError().invalidInput("projectId is required")
  }
  if (!title) {
    throw createOrchestrationError().invalidInput("title is required")
  }

  return {
    id,
    projectId,
    title,
    description: input.description?.trim() || null,
    initPrompt: input.initPrompt?.trim() || null,
    config: input.config ? structuredClone(input.config) : null,
    status: input.status ?? "active",
    archivedAt: input.archivedAt ?? null,
    createdAt,
    updatedAt,
  }
}

export function assertOrchestrationIsActive(orchestration: Orchestration) {
  if (orchestration.archivedAt || orchestration.status === "archived") {
    throw createOrchestrationError().invalidState(
      "archived orchestrations cannot accept new tasks",
    )
  }
}
