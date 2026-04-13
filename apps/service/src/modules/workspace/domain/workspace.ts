import { createWorkspaceError } from "../errors"

export type WorkspaceType = "personal" | "team"
export type WorkspaceStatus = "active" | "archived"
export type MembershipRole = "owner" | "member"
export type MembershipStatus = "active" | "removed"
export type WorkspaceInvitationRole = "member"
export type WorkspaceInvitationStatus = "pending" | "accepted" | "revoked"

export type Membership = {
  workspaceId: string
  userId: string
  role: MembershipRole
  status: MembershipStatus
  createdAt: Date
  updatedAt: Date
}

export type Workspace = {
  id: string
  slug: string
  name: string
  type: WorkspaceType
  status: WorkspaceStatus
  createdByUserId: string
  createdAt: Date
  updatedAt: Date
  archivedAt: Date | null
  memberships: Membership[]
}

export type WorkspaceInvitation = {
  id: string
  workspaceId: string
  inviteeGithubLogin: string
  role: WorkspaceInvitationRole
  status: WorkspaceInvitationStatus
  invitedByUserId: string
  acceptedByUserId: string | null
  createdAt: Date
  updatedAt: Date
  acceptedAt: Date | null
}

export type CreateWorkspaceInput = {
  id: string
  name: string
  type: WorkspaceType
  createdByUserId: string
  now?: Date
}

export type AddWorkspaceMemberInput = {
  userId: string
}

export type CreateWorkspaceInvitationInput = {
  id: string
  inviteeGithubLogin: string
  invitedByUserId: string
  now?: Date
}

export function deriveWorkspaceSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function requireNonEmpty(value: string, field: string) {
  if (!value.trim()) {
    throw createWorkspaceError().invalidInput(`${field} is required`)
  }
}

export function createWorkspace(input: CreateWorkspaceInput): Workspace {
  requireNonEmpty(input.id, "id")
  requireNonEmpty(input.name, "name")
  requireNonEmpty(input.createdByUserId, "createdByUserId")

  const now = input.now ?? new Date()
  const slug = deriveWorkspaceSlug(input.name)
  if (!slug) {
    throw createWorkspaceError().invalidInput("workspace slug cannot be empty")
  }

  return {
    id: input.id.trim(),
    slug,
    name: input.name.trim(),
    type: input.type,
    status: "active",
    createdByUserId: input.createdByUserId.trim(),
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    memberships: [
      {
        workspaceId: input.id.trim(),
        userId: input.createdByUserId.trim(),
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}

export function addWorkspaceMember(
  workspace: Workspace,
  input: AddWorkspaceMemberInput,
  now = new Date(),
): Workspace {
  requireNonEmpty(input.userId, "userId")

  if (workspace.type !== "team") {
    throw createWorkspaceError().invalidState(
      "only team workspaces can manage members",
    )
  }

  const existingMembership = workspace.memberships.find(
    (membership) => membership.userId === input.userId,
  )

  if (existingMembership?.status === "active") {
    return workspace
  }

  if (existingMembership) {
    return {
      ...workspace,
      updatedAt: now,
      memberships: workspace.memberships.map((membership) =>
        membership.userId === input.userId
          ? {
              ...membership,
              status: "active",
              updatedAt: now,
            }
          : membership,
      ),
    }
  }

  return {
    ...workspace,
    updatedAt: now,
    memberships: [
      ...workspace.memberships,
      {
        workspaceId: workspace.id,
        userId: input.userId.trim(),
        role: "member",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}

export function removeWorkspaceMember(
  workspace: Workspace,
  userId: string,
  now = new Date(),
): Workspace {
  requireNonEmpty(userId, "userId")

  if (workspace.type !== "team") {
    throw createWorkspaceError().invalidState(
      "only team workspaces can manage members",
    )
  }

  const membership = workspace.memberships.find(
    (candidate) => candidate.userId === userId,
  )

  if (!membership || membership.status === "removed") {
    return workspace
  }

  if (membership.role === "owner") {
    throw createWorkspaceError().invalidState("owner membership cannot be removed")
  }

  return {
    ...workspace,
    updatedAt: now,
    memberships: workspace.memberships.map((candidate) =>
      candidate.userId === userId
        ? {
            ...candidate,
            status: "removed",
            updatedAt: now,
          }
        : candidate,
    ),
  }
}

export function createWorkspaceInvitation(
  workspace: Workspace,
  input: CreateWorkspaceInvitationInput,
): WorkspaceInvitation {
  requireNonEmpty(input.id, "id")
  requireNonEmpty(input.inviteeGithubLogin, "inviteeGithubLogin")
  requireNonEmpty(input.invitedByUserId, "invitedByUserId")

  if (workspace.type !== "team") {
    throw createWorkspaceError().invalidState(
      "only team workspaces can create invitations",
    )
  }

  const now = input.now ?? new Date()

  return {
    id: input.id.trim(),
    workspaceId: workspace.id,
    inviteeGithubLogin: input.inviteeGithubLogin.trim().toLowerCase(),
    role: "member",
    status: "pending",
    invitedByUserId: input.invitedByUserId.trim(),
    acceptedByUserId: null,
    createdAt: now,
    updatedAt: now,
    acceptedAt: null,
  }
}

export function acceptWorkspaceInvitation(
  invitation: WorkspaceInvitation,
  input: {
    acceptedByUserId: string
  },
  now = new Date(),
): WorkspaceInvitation {
  requireNonEmpty(input.acceptedByUserId, "acceptedByUserId")

  if (invitation.status !== "pending") {
    throw createWorkspaceError().invalidState("workspace invitation is not pending")
  }

  return {
    ...invitation,
    status: "accepted",
    acceptedByUserId: input.acceptedByUserId.trim(),
    acceptedAt: now,
    updatedAt: now,
  }
}
