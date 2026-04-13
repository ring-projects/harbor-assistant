import type { Membership } from "../domain/workspace"
import type { WorkspaceRepository } from "./workspace-repository"

export async function listWorkspaceMembersUseCase(
  repository: WorkspaceRepository,
  workspaceId: string,
): Promise<Membership[]> {
  return repository.listMembers(workspaceId)
}
