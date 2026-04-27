import { createOrchestrationError } from "../errors"
import type { OrchestrationSchedule } from "./orchestration-schedule"

export type OrchestrationStatus = "active" | "archived"

export type Orchestration = {
  id: string
  projectId: string
  title: string
  description: string | null
  status: OrchestrationStatus
  archivedAt: Date | null
  schedule: OrchestrationSchedule | null
  createdAt: Date
  updatedAt: Date
}

export const DEFAULT_ORCHESTRATION_TITLE = "New session"

export function resolveOrchestrationTitle(input: {
  title?: string | null
  fallbackTitle?: string | null
}) {
  const title = input.title?.trim()
  if (title) {
    return title
  }

  const fallbackTitle = input.fallbackTitle?.trim()
  if (fallbackTitle) {
    return fallbackTitle
  }

  return DEFAULT_ORCHESTRATION_TITLE
}

export function createOrchestration(input: {
  id: string
  projectId: string
  title?: string | null
  fallbackTitle?: string | null
  description?: string | null
  status?: OrchestrationStatus
  archivedAt?: Date | null
  schedule?: OrchestrationSchedule | null
  createdAt?: Date
  updatedAt?: Date
}): Orchestration {
  const id = input.id.trim()
  const projectId = input.projectId.trim()
  const title = resolveOrchestrationTitle({
    title: input.title,
    fallbackTitle: input.fallbackTitle,
  })
  const createdAt = input.createdAt ?? new Date()
  const updatedAt = input.updatedAt ?? createdAt

  if (!id) {
    throw createOrchestrationError().invalidInput("id is required")
  }
  if (!projectId) {
    throw createOrchestrationError().invalidInput("projectId is required")
  }

  return {
    id,
    projectId,
    title,
    description: input.description?.trim() || null,
    status: input.status ?? "active",
    archivedAt: input.archivedAt ?? null,
    schedule: input.schedule ?? null,
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
