import type { FastifyInstance } from "fastify"

import type { UserDirectory } from "../../user"
import type { WorkspaceInvitationRepository } from "../application/workspace-invitation-repository"
import type { WorkspaceRepository } from "../application/workspace-repository"
import { registerWorkspaceRoutes } from "./workspace.routes"

export async function registerWorkspaceModuleRoutes(
  app: FastifyInstance,
  options: {
    repository: WorkspaceRepository
    invitationRepository: WorkspaceInvitationRepository
    userDirectory: UserDirectory
  },
) {
  await registerWorkspaceRoutes(app, options)
}
