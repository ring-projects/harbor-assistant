import type { Workspace } from "../domain/workspace"
import { ensurePersonalWorkspaceUseCase } from "./ensure-personal-workspace"
import type { WorkspaceRepository } from "./workspace-repository"

export async function listUserWorkspacesUseCase(
  repository: WorkspaceRepository,
  input: {
    userId: string
    fallbackName: string
    now?: Date
  },
): Promise<Workspace[]> {
  await ensurePersonalWorkspaceUseCase(repository, input)

  return repository.listByMemberUserId(input.userId)
}
