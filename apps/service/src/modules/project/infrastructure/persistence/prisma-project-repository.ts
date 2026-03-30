import { Prisma, type PrismaClient } from "@prisma/client"

import type { Project } from "../../domain/project"
import type { ProjectRepository } from "../../application/project-repository"
import { createProjectError } from "../../errors"
import { toDomainProject } from "./project-mapper"

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Project | null> {
    const project = await this.prisma.project.findUnique({ where: { id } })

    if (!project) {
      return null
    }

    return toDomainProject(project)
  }

  async findByNormalizedPath(normalizedPath: string): Promise<Project | null> {
    const project = await this.prisma.project.findUnique({ where: { normalizedPath } })

    if (!project) {
      return null
    }

    return toDomainProject(project)
  }

  async findBySlug(slug: string): Promise<Project | null> {
    const project = await this.prisma.project.findUnique({ where: { slug } })

    if (!project) {
      return null
    }

    return toDomainProject(project)
  }

  async list(): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      orderBy: [{ updatedAt: "desc" }],
    })

    return projects.map(toDomainProject)
  }

  async save(project: Project): Promise<void> {
    try {
      await this.prisma.project.upsert({
        where: { id: project.id },
        create: {
          id: project.id,
          slug: project.slug,
          name: project.name,
          description: project.description,
          rootPath: project.rootPath,
          normalizedPath: project.normalizedPath,
          status: project.status,
          lastOpenedAt: project.lastOpenedAt,
          logRetentionDays: project.settings.retention.logRetentionDays,
          eventRetentionDays: project.settings.retention.eventRetentionDays,
          harborSkillsEnabled: project.settings.skills.harborSkillsEnabled,
          harborSkillProfile: project.settings.skills.harborSkillProfile,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          archivedAt: project.archivedAt,
        },
        update: {
          slug: project.slug,
          name: project.name,
          description: project.description,
          rootPath: project.rootPath,
          normalizedPath: project.normalizedPath,
          status: project.status,
          lastOpenedAt: project.lastOpenedAt,
          logRetentionDays: project.settings.retention.logRetentionDays,
          eventRetentionDays: project.settings.retention.eventRetentionDays,
          harborSkillsEnabled: project.settings.skills.harborSkillsEnabled,
          harborSkillProfile: project.settings.skills.harborSkillProfile,
          updatedAt: project.updatedAt,
          archivedAt: project.archivedAt,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const target = Array.isArray(error.meta?.target) ? error.meta?.target : []
        if (target.includes("normalizedPath")) {
          throw createProjectError().duplicatePath()
        }
        if (target.includes("slug")) {
          throw createProjectError().duplicateSlug()
        }
      }

      throw error
    }
  }

  async delete(id: string): Promise<void> {
    await this.prisma.project.delete({
      where: { id },
    })
  }
}
