export type WorkspaceMembership = {
  workspaceId: string
  userId: string
  role: "owner" | "member"
  status: "active" | "removed"
  createdAt: string
  updatedAt: string
}

export type Workspace = {
  id: string
  slug: string
  name: string
  type: "personal" | "team"
  status: "active" | "archived"
  createdByUserId: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  memberships: WorkspaceMembership[]
}

export type WorkspaceInvitation = {
  id: string
  workspaceId: string
  inviteeGithubLogin: string
  role: "member"
  status: "pending" | "accepted" | "revoked"
  invitedByUserId: string
  acceptedByUserId: string | null
  createdAt: string
  updatedAt: string
  acceptedAt: string | null
}
