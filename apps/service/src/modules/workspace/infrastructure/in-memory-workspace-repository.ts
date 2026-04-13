import type { Membership, Workspace } from "../domain/workspace"
import type { WorkspaceRepository } from "../application/workspace-repository"

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly workspaces = new Map<string, Workspace>()

  async findById(id: string): Promise<Workspace | null> {
    return this.workspaces.get(id) ?? null
  }

  async findPersonalByUserId(userId: string): Promise<Workspace | null> {
    for (const workspace of this.workspaces.values()) {
      if (
        workspace.type === "personal" &&
        workspace.memberships.some(
          (membership) =>
            membership.userId === userId && membership.status === "active",
        )
      ) {
        return workspace
      }
    }

    return null
  }

  async listByMemberUserId(userId: string): Promise<Workspace[]> {
    return Array.from(this.workspaces.values())
      .filter((workspace) =>
        workspace.memberships.some(
          (membership) =>
            membership.userId === userId && membership.status === "active",
        ),
      )
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
  }

  async listMembers(workspaceId: string): Promise<Membership[]> {
    return this.workspaces.get(workspaceId)?.memberships ?? []
  }

  async save(workspace: Workspace): Promise<void> {
    this.workspaces.set(workspace.id, workspace)
  }
}
