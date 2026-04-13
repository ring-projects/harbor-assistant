import { createWorkspaceUseCase } from "./create-workspace"
import type { WorkspaceRepository } from "./workspace-repository"

export async function ensurePersonalWorkspaceUseCase(
  repository: WorkspaceRepository,
  input: {
    userId: string
    fallbackName: string
    now?: Date
  },
) {
  const existingWorkspace = await repository.findPersonalByUserId(input.userId)
  if (existingWorkspace) {
    return existingWorkspace
  }

  return createWorkspaceUseCase(repository, {
    name: input.fallbackName,
    type: "personal",
    createdByUserId: input.userId,
    now: input.now,
  })
}
