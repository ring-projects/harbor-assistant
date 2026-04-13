import { addWorkspaceMember, removeWorkspaceMember } from "../domain/workspace"
import { createWorkspaceError } from "../errors"
import type { UserDirectory } from "../../user"
import type { WorkspaceRepository } from "./workspace-repository"
import {
  requireWorkspaceForMember,
  requireWorkspaceForOwner,
} from "./workspace-access"

export async function listWorkspaceMembersForUserUseCase(
  repository: WorkspaceRepository,
  input: {
    workspaceId: string
    actorUserId: string
  },
) {
  const workspace = await requireWorkspaceForMember(repository, {
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
  })

  return workspace.memberships
}

export async function addWorkspaceMemberUseCase(
  deps: {
    workspaceRepository: WorkspaceRepository
    userDirectory: UserDirectory
  },
  input: {
    workspaceId: string
    actorUserId: string
    githubLogin: string
    now?: Date
  },
) {
  const workspace = await requireWorkspaceForOwner(deps.workspaceRepository, {
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    errorMessage: "only workspace owners can manage members",
  })
  const user = await deps.userDirectory.findByGithubLogin(input.githubLogin.trim())

  if (!user) {
    throw createWorkspaceError().notFound("workspace member user not found")
  }

  const next = addWorkspaceMember(
    workspace,
    {
      userId: user.id,
    },
    input.now,
  )

  await deps.workspaceRepository.save(next)
  const membership = next.memberships.find(
    (candidate) => candidate.userId === user.id,
  )

  if (!membership) {
    throw createWorkspaceError().invalidState(
      "workspace member was not materialized",
    )
  }

  return {
    workspace: next,
    membership,
  }
}

export async function removeWorkspaceMemberUseCase(
  deps: {
    workspaceRepository: WorkspaceRepository
  },
  input: {
    workspaceId: string
    actorUserId: string
    memberUserId: string
    now?: Date
  },
) {
  const workspace = await requireWorkspaceForOwner(deps.workspaceRepository, {
    workspaceId: input.workspaceId,
    userId: input.actorUserId,
    errorMessage: "only workspace owners can manage members",
  })

  const next = removeWorkspaceMember(workspace, input.memberUserId, input.now)
  await deps.workspaceRepository.save(next)
  const membership = next.memberships.find(
    (candidate) => candidate.userId === input.memberUserId,
  )

  if (!membership) {
    throw createWorkspaceError().invalidState(
      "workspace member was not found after removal",
    )
  }

  return {
    workspace: next,
    membership,
  }
}
