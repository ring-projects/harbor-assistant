import { randomUUID } from "node:crypto"

import { createWorkspace } from "../domain/workspace"
import type { WorkspaceRepository } from "./workspace-repository"
import { createWorkspaceError } from "../errors"

export async function createWorkspaceUseCase(
  repository: WorkspaceRepository,
  input: {
    id?: string
    name: string
    type: "personal" | "team"
    createdByUserId: string
    now?: Date
  },
) {
  const workspace = createWorkspace({
    id: input.id ?? randomUUID(),
    name: input.name,
    type: input.type,
    createdByUserId: input.createdByUserId,
    now: input.now,
  })

  const existing = await repository.listByMemberUserId(input.createdByUserId)
  if (
    existing.some(
      (candidate) =>
        candidate.type === input.type && candidate.slug === workspace.slug,
    )
  ) {
    throw createWorkspaceError().duplicateSlug()
  }

  await repository.save(workspace)
  return workspace
}
