import type { Membership, Workspace } from "../domain/workspace"

export interface WorkspaceRepository {
  findById(id: string): Promise<Workspace | null>
  findPersonalByUserId(userId: string): Promise<Workspace | null>
  listByMemberUserId(userId: string): Promise<Workspace[]>
  listMembers(workspaceId: string): Promise<Membership[]>
  save(workspace: Workspace): Promise<void>
}
