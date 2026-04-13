import { Prisma, type PrismaClient } from "@prisma/client"

import type { WorkspaceRepository } from "../../application/workspace-repository"
import type { Membership, Workspace } from "../../domain/workspace"
import { createWorkspaceError } from "../../errors"

function toDomainMembership(
  membership: {
    workspaceId: string
    userId: string
    role: "owner" | "member"
    status: "active" | "removed"
    createdAt: Date
    updatedAt: Date
  },
): Membership {
  return {
    workspaceId: membership.workspaceId,
    userId: membership.userId,
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  }
}

function toDomainWorkspace(
  workspace: {
    id: string
    slug: string
    name: string
    type: "personal" | "team"
    status: "active" | "archived"
    createdByUserId: string
    createdAt: Date
    updatedAt: Date
    archivedAt: Date | null
    memberships: Array<{
      workspaceId: string
      userId: string
      role: "owner" | "member"
      status: "active" | "removed"
      createdAt: Date
      updatedAt: Date
    }>
  },
): Workspace {
  return {
    id: workspace.id,
    slug: workspace.slug,
    name: workspace.name,
    type: workspace.type,
    status: workspace.status,
    createdByUserId: workspace.createdByUserId,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    archivedAt: workspace.archivedAt,
    memberships: workspace.memberships.map(toDomainMembership),
  }
}

export class PrismaWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Workspace | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id },
      include: { memberships: true },
    })

    return workspace ? toDomainWorkspace(workspace) : null
  }

  async findPersonalByUserId(userId: string): Promise<Workspace | null> {
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        type: "personal",
        memberships: {
          some: {
            userId,
            status: "active",
          },
        },
      },
      include: { memberships: true },
      orderBy: [{ updatedAt: "desc" }],
    })

    return workspace ? toDomainWorkspace(workspace) : null
  }

  async listByMemberUserId(userId: string): Promise<Workspace[]> {
    const workspaces = await this.prisma.workspace.findMany({
      where: {
        memberships: {
          some: {
            userId,
            status: "active",
          },
        },
      },
      include: { memberships: true },
      orderBy: [{ updatedAt: "desc" }],
    })

    return workspaces.map(toDomainWorkspace)
  }

  async listMembers(workspaceId: string): Promise<Membership[]> {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "asc" }],
    })

    return memberships.map(toDomainMembership)
  }

  async save(workspace: Workspace): Promise<void> {
    try {
      await this.prisma.workspace.upsert({
        where: { id: workspace.id },
        create: {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          type: workspace.type,
          status: workspace.status,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          archivedAt: workspace.archivedAt,
          createdByUser: {
            connect: {
              id: workspace.createdByUserId,
            },
          },
          memberships: {
            create: workspace.memberships.map((membership) => ({
              user: {
                connect: {
                  id: membership.userId,
                },
              },
              role: membership.role,
              status: membership.status,
              createdAt: membership.createdAt,
              updatedAt: membership.updatedAt,
            })),
          },
        },
        update: {
          slug: workspace.slug,
          name: workspace.name,
          type: workspace.type,
          status: workspace.status,
          updatedAt: workspace.updatedAt,
          archivedAt: workspace.archivedAt,
          memberships: {
            deleteMany: {},
            create: workspace.memberships.map((membership) => ({
              user: {
                connect: {
                  id: membership.userId,
                },
              },
              role: membership.role,
              status: membership.status,
              createdAt: membership.createdAt,
              updatedAt: membership.updatedAt,
            })),
          },
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw createWorkspaceError().duplicateSlug()
      }

      throw error
    }
  }
}
