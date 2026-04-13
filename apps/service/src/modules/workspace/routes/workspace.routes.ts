import type { FastifyInstance } from "fastify"

import type { UserDirectory } from "../../user"
import { createWorkspaceUseCase } from "../application/create-workspace"
import {
  addWorkspaceMemberUseCase,
  listWorkspaceMembersForUserUseCase,
  removeWorkspaceMemberUseCase,
} from "../application/manage-workspace-members"
import {
  acceptWorkspaceInvitationUseCase,
  createWorkspaceInvitationUseCase,
  listWorkspaceInvitationsForUserUseCase,
} from "../application/manage-workspace-invitations"
import type { WorkspaceInvitationRepository } from "../application/workspace-invitation-repository"
import { listUserWorkspacesUseCase } from "../application/list-user-workspaces"
import type { WorkspaceRepository } from "../application/workspace-repository"
import { toWorkspaceAppError } from "../workspace-app-error"

type WorkspaceRouteOptions = {
  repository: WorkspaceRepository
  invitationRepository: WorkspaceInvitationRepository
  userDirectory: UserDirectory
}

export async function registerWorkspaceRoutes(
  app: FastifyInstance,
  options: WorkspaceRouteOptions,
) {
  app.get("/workspaces", async (request) => {
    const workspaces = await listUserWorkspacesUseCase(options.repository, {
      userId: request.auth!.userId,
      fallbackName: request.auth!.user.name?.trim() || request.auth!.user.githubLogin,
    })

    return {
      ok: true,
      workspaces,
    }
  })

  app.post<{
    Body: {
      id?: string
      name: string
    }
  }>("/workspaces", async (request, reply) => {
    try {
      const workspace = await createWorkspaceUseCase(options.repository, {
        id: request.body.id,
        name: request.body.name,
        type: "team",
        createdByUserId: request.auth!.userId,
      })

      return reply.status(201).send({
        ok: true,
        workspace,
      })
    } catch (error) {
      throw toWorkspaceAppError(error)
    }
  })

  app.get<{
    Params: {
      id: string
    }
  }>("/workspaces/:id/members", async (request) => {
    try {
      const memberships = await listWorkspaceMembersForUserUseCase(
        options.repository,
        {
          workspaceId: request.params.id,
          actorUserId: request.auth!.userId,
        },
      )

      return {
        ok: true,
        memberships,
      }
    } catch (error) {
      throw toWorkspaceAppError(error)
    }
  })

  app.post<{
    Params: {
      id: string
    }
    Body: {
      githubLogin: string
    }
  }>("/workspaces/:id/members", async (request) => {
    try {
      const result = await addWorkspaceMemberUseCase(
        {
          workspaceRepository: options.repository,
          userDirectory: options.userDirectory,
        },
        {
          workspaceId: request.params.id,
          actorUserId: request.auth!.userId,
          githubLogin: request.body.githubLogin,
        },
      )

      return {
        ok: true,
        membership: result.membership,
      }
    } catch (error) {
      throw toWorkspaceAppError(error)
    }
  })

  app.delete<{
    Params: {
      id: string
      userId: string
    }
  }>("/workspaces/:id/members/:userId", async (request) => {
    try {
      const result = await removeWorkspaceMemberUseCase(
        {
          workspaceRepository: options.repository,
        },
        {
          workspaceId: request.params.id,
          actorUserId: request.auth!.userId,
          memberUserId: request.params.userId,
        },
      )

      return {
        ok: true,
        membership: result.membership,
      }
    } catch (error) {
      throw toWorkspaceAppError(error)
    }
  })

  app.get<{
    Params: {
      id: string
    }
  }>("/workspaces/:id/invitations", async (request) => {
    try {
      const invitations = await listWorkspaceInvitationsForUserUseCase(
        {
          workspaceRepository: options.repository,
          invitationRepository: options.invitationRepository,
        },
        {
          workspaceId: request.params.id,
          actorUserId: request.auth!.userId,
        },
      )

      return {
        ok: true,
        invitations,
      }
    } catch (error) {
      throw toWorkspaceAppError(error)
    }
  })

  app.post<{
    Params: {
      id: string
    }
    Body: {
      githubLogin: string
    }
  }>("/workspaces/:id/invitations", async (request, reply) => {
    try {
      const invitation = await createWorkspaceInvitationUseCase(
        {
          workspaceRepository: options.repository,
          invitationRepository: options.invitationRepository,
          userDirectory: options.userDirectory,
        },
        {
          workspaceId: request.params.id,
          actorUserId: request.auth!.userId,
          inviteeGithubLogin: request.body.githubLogin,
        },
      )

      return reply.status(201).send({
        ok: true,
        invitation,
      })
    } catch (error) {
      throw toWorkspaceAppError(error)
    }
  })

  app.post<{
    Params: {
      invitationId: string
    }
  }>("/workspace-invitations/:invitationId/accept", async (request) => {
    try {
      const result = await acceptWorkspaceInvitationUseCase(
        {
          workspaceRepository: options.repository,
          invitationRepository: options.invitationRepository,
        },
        {
          invitationId: request.params.invitationId,
          actorUserId: request.auth!.userId,
          actorGithubLogin: request.auth!.user.githubLogin,
        },
      )
      const membership = result.workspace.memberships.find(
        (item) => item.userId === request.auth!.userId && item.status === "active",
      )

      return {
        ok: true,
        invitation: result.invitation,
        membership,
      }
    } catch (error) {
      throw toWorkspaceAppError(error)
    }
  })
}
