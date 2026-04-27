import type { FastifyInstance } from "fastify"

import { requireUserAuthenticatedRequest } from "../../auth"
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
import {
  getWorkspaceSettingsForUserUseCase,
  updateWorkspaceSettingsUseCase,
} from "../application/update-workspace-settings"
import type { WorkspaceInvitationRepository } from "../application/workspace-invitation-repository"
import { listUserWorkspacesUseCase } from "../application/list-user-workspaces"
import type { WorkspaceRepository } from "../application/workspace-repository"
import type {
  AcceptWorkspaceInvitationParams,
  CreateWorkspaceBody,
  UpdateWorkspaceSettingsBody,
  WorkspaceGithubLoginBody,
  WorkspaceIdParams,
  WorkspaceMemberParams,
} from "../schemas"
import {
  acceptWorkspaceInvitationRouteSchema,
  addWorkspaceMemberRouteSchema,
  createWorkspaceInvitationRouteSchema,
  createWorkspaceRouteSchema,
  getWorkspaceSettingsRouteSchema,
  listUserWorkspacesRouteSchema,
  listWorkspaceInvitationsRouteSchema,
  listWorkspaceMembersRouteSchema,
  removeWorkspaceMemberRouteSchema,
  updateWorkspaceSettingsRouteSchema,
} from "../schemas"
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
  app.get(
    "/workspaces",
    {
      schema: listUserWorkspacesRouteSchema,
    },
    async (request) => {
      const auth = requireUserAuthenticatedRequest(request)
      const workspaces = await listUserWorkspacesUseCase(options.repository, {
        userId: auth.userId,
        fallbackName: auth.user.name?.trim() || auth.user.githubLogin,
      })

      return {
        ok: true,
        workspaces,
      }
    },
  )

  app.post<{ Body: CreateWorkspaceBody }>(
    "/workspaces",
    {
      schema: createWorkspaceRouteSchema,
    },
    async (request, reply) => {
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
    },
  )

  app.get<{ Params: WorkspaceIdParams }>(
    "/workspaces/:id/settings",
    {
      schema: getWorkspaceSettingsRouteSchema,
    },
    async (request) => {
      try {
        const settings = await getWorkspaceSettingsForUserUseCase(
          options.repository,
          {
            workspaceId: request.params.id,
            actorUserId: request.auth!.userId,
          },
        )

        return {
          ok: true,
          settings,
        }
      } catch (error) {
        throw toWorkspaceAppError(error)
      }
    },
  )

  app.patch<{ Params: WorkspaceIdParams; Body: UpdateWorkspaceSettingsBody }>(
    "/workspaces/:id/settings",
    {
      schema: updateWorkspaceSettingsRouteSchema,
    },
    async (request) => {
      try {
        const workspace = await updateWorkspaceSettingsUseCase(
          options.repository,
          {
            workspaceId: request.params.id,
            actorUserId: request.auth!.userId,
            changes: request.body,
          },
        )

        return {
          ok: true,
          workspace,
        }
      } catch (error) {
        throw toWorkspaceAppError(error)
      }
    },
  )

  app.get<{ Params: WorkspaceIdParams }>(
    "/workspaces/:id/members",
    {
      schema: listWorkspaceMembersRouteSchema,
    },
    async (request) => {
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
    },
  )

  app.post<{ Params: WorkspaceIdParams; Body: WorkspaceGithubLoginBody }>(
    "/workspaces/:id/members",
    {
      schema: addWorkspaceMemberRouteSchema,
    },
    async (request) => {
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
    },
  )

  app.delete<{ Params: WorkspaceMemberParams }>(
    "/workspaces/:id/members/:userId",
    {
      schema: removeWorkspaceMemberRouteSchema,
    },
    async (request) => {
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
    },
  )

  app.get<{ Params: WorkspaceIdParams }>(
    "/workspaces/:id/invitations",
    {
      schema: listWorkspaceInvitationsRouteSchema,
    },
    async (request) => {
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
    },
  )

  app.post<{ Params: WorkspaceIdParams; Body: WorkspaceGithubLoginBody }>(
    "/workspaces/:id/invitations",
    {
      schema: createWorkspaceInvitationRouteSchema,
    },
    async (request, reply) => {
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
    },
  )

  app.post<{ Params: AcceptWorkspaceInvitationParams }>(
    "/workspace-invitations/:invitationId/accept",
    {
      schema: acceptWorkspaceInvitationRouteSchema,
    },
    async (request) => {
      try {
        const auth = requireUserAuthenticatedRequest(request)
        const result = await acceptWorkspaceInvitationUseCase(
          {
            workspaceRepository: options.repository,
            invitationRepository: options.invitationRepository,
          },
          {
            invitationId: request.params.invitationId,
            actorUserId: auth.userId,
            actorGithubLogin: auth.user.githubLogin,
          },
        )
        const membership = result.workspace.memberships.find(
          (item) => item.userId === auth.userId && item.status === "active",
        )

        return {
          ok: true,
          invitation: result.invitation,
          membership,
        }
      } catch (error) {
        throw toWorkspaceAppError(error)
      }
    },
  )
}
