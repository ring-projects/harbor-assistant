import type { PrismaClient } from "@prisma/client"

import type { WorkspaceInvitationRepository } from "../../application/workspace-invitation-repository"
import type { WorkspaceInvitation } from "../../domain/workspace"

function toDomainInvitation(invitation: {
  id: string
  workspaceId: string
  inviteeGithubLogin: string
  role: "member"
  status: "pending" | "accepted" | "revoked"
  invitedByUserId: string
  acceptedByUserId: string | null
  createdAt: Date
  updatedAt: Date
  acceptedAt: Date | null
}): WorkspaceInvitation {
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    inviteeGithubLogin: invitation.inviteeGithubLogin,
    role: invitation.role,
    status: invitation.status,
    invitedByUserId: invitation.invitedByUserId,
    acceptedByUserId: invitation.acceptedByUserId,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    acceptedAt: invitation.acceptedAt,
  }
}

export class PrismaWorkspaceInvitationRepository implements WorkspaceInvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<WorkspaceInvitation | null> {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { id },
    })

    return invitation ? toDomainInvitation(invitation) : null
  }

  async findPendingByWorkspaceIdAndGithubLogin(
    workspaceId: string,
    githubLogin: string,
  ): Promise<WorkspaceInvitation | null> {
    const invitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        inviteeGithubLogin: githubLogin.trim().toLowerCase(),
        status: "pending",
      },
      orderBy: [{ createdAt: "desc" }],
    })

    return invitation ? toDomainInvitation(invitation) : null
  }

  async listByWorkspaceId(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "desc" }],
    })

    return invitations.map(toDomainInvitation)
  }

  async listPendingByGithubLogin(
    githubLogin: string,
  ): Promise<WorkspaceInvitation[]> {
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: {
        inviteeGithubLogin: githubLogin.trim().toLowerCase(),
        status: "pending",
      },
      orderBy: [{ createdAt: "desc" }],
    })

    return invitations.map(toDomainInvitation)
  }

  async save(invitation: WorkspaceInvitation): Promise<void> {
    await this.prisma.workspaceInvitation.upsert({
      where: { id: invitation.id },
      create: {
        id: invitation.id,
        workspaceId: invitation.workspaceId,
        inviteeGithubLogin: invitation.inviteeGithubLogin,
        role: invitation.role,
        status: invitation.status,
        invitedByUserId: invitation.invitedByUserId,
        acceptedByUserId: invitation.acceptedByUserId,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
        acceptedAt: invitation.acceptedAt,
      },
      update: {
        status: invitation.status,
        acceptedByUserId: invitation.acceptedByUserId,
        updatedAt: invitation.updatedAt,
        acceptedAt: invitation.acceptedAt,
      },
    })
  }
}
