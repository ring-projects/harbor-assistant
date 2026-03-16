import { realpath, stat } from "node:fs/promises"
import path from "node:path"
import {
  Prisma,
  type PrismaClient,
  type Project as PrismaProjectModel,
} from "@prisma/client"

import type { Project } from "../types"
import { createProjectError } from "../errors"

export type ProjectDbClient = PrismaClient | Prisma.TransactionClient

export type ListProjectsOptions = {
  status?: "active" | "archived" | "missing"
  includeSettings?: boolean
}

export type AddProjectInput = {
  path: string
  name?: string
  description?: string
}

export type UpdateProjectInput = {
  id: string
  path?: string
  name?: string
  description?: string
  status?: "active" | "archived" | "missing"
}

async function resolveProjectPath(rawPath: string): Promise<string> {
  const trimmedPath = rawPath.trim()
  if (!trimmedPath) {
    throw createProjectError.invalidPath("Project path cannot be empty")
  }

  const absolutePath = path.isAbsolute(trimmedPath)
    ? path.resolve(trimmedPath)
    : path.resolve(process.cwd(), trimmedPath)

  let canonicalPath: string
  try {
    canonicalPath = await realpath(absolutePath)
  } catch {
    throw createProjectError.pathNotFound(absolutePath)
  }

  let pathStats
  try {
    pathStats = await stat(canonicalPath)
  } catch {
    throw createProjectError.pathNotFound(canonicalPath)
  }

  if (!pathStats.isDirectory()) {
    throw createProjectError.notADirectory(canonicalPath)
  }

  return canonicalPath
}

function buildProjectName(canonicalPath: string, explicitName?: string): string {
  const trimmedName = explicitName?.trim()
  if (trimmedName) {
    return trimmedName
  }

  const basename = path.basename(canonicalPath)
  return basename || canonicalPath
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function toDomainProject(prismaProject: PrismaProjectModel): Project {
  return {
    id: prismaProject.id,
    name: prismaProject.name,
    slug: prismaProject.slug,
    rootPath: prismaProject.rootPath,
    normalizedPath: prismaProject.normalizedPath,
    description: prismaProject.description,
    status: prismaProject.status,
    lastOpenedAt: prismaProject.lastOpenedAt,
    createdAt: prismaProject.createdAt,
    updatedAt: prismaProject.updatedAt,
    archivedAt: prismaProject.archivedAt,
    path: prismaProject.normalizedPath,
  }
}

export function createProjectRepository(prisma: ProjectDbClient) {
  async function listProjects(options?: ListProjectsOptions): Promise<Project[]> {
    try {
      const projects = await prisma.project.findMany({
        where: options?.status ? { status: options.status } : undefined,
        include: options?.includeSettings ? { settings: true } : undefined,
        orderBy: { updatedAt: "desc" },
      })

      return projects.map(toDomainProject)
    } catch (error) {
      throw createProjectError.dbReadError("list projects", error)
    }
  }

  async function getProjectById(
    id: string,
    options?: { includeSettings?: boolean },
  ): Promise<Project | null> {
    const trimmedId = id.trim()
    if (!trimmedId) {
      return null
    }

    try {
      const project = await prisma.project.findUnique({
        where: { id: trimmedId },
        include: options?.includeSettings ? { settings: true } : undefined,
      })

      return project ? toDomainProject(project) : null
    } catch (error) {
      throw createProjectError.dbReadError("get project by id", error)
    }
  }

  async function getProjectByPath(normalizedPath: string): Promise<Project | null> {
    try {
      const project = await prisma.project.findUnique({
        where: { normalizedPath },
      })

      return project ? toDomainProject(project) : null
    } catch (error) {
      throw createProjectError.dbReadError("get project by path", error)
    }
  }

  async function addProject(input: AddProjectInput): Promise<Project> {
    const canonicalPath = await resolveProjectPath(input.path)
    const projectName = buildProjectName(canonicalPath, input.name)
    const slug = generateSlug(projectName)

    try {
      const project = await prisma.project.create({
        data: {
          name: projectName,
          slug,
          rootPath: canonicalPath,
          normalizedPath: canonicalPath,
          description: input.description,
          status: "active",
          settings: {
            create: {
              defaultExecutor: "codex",
              defaultExecutionMode: "safe",
              maxConcurrentTasks: 1,
              logRetentionDays: 30,
              eventRetentionDays: 7,
              harborSkillsEnabled: false,
              harborSkillProfile: "default",
            },
          },
        },
        include: {
          settings: true,
        },
      })

      return toDomainProject(project)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          const target = (error.meta?.target as string[]) || []
          if (target.includes("normalizedPath")) {
            throw createProjectError.duplicatePath(canonicalPath)
          }
          if (target.includes("slug")) {
            throw createProjectError.duplicateSlug(slug)
          }
        }
      }

      throw createProjectError.dbWriteError("create project", error)
    }
  }

  async function updateProject(input: UpdateProjectInput): Promise<Project | null> {
    const trimmedId = input.id.trim()
    if (!trimmedId) {
      throw createProjectError.invalidProjectId("Project ID cannot be empty")
    }

    const existing = await getProjectById(trimmedId)
    if (!existing) {
      return null
    }

    let nextPath = existing.normalizedPath
    if (typeof input.path === "string") {
      nextPath = await resolveProjectPath(input.path)
    }

    let nextName = existing.name
    if (typeof input.name === "string") {
      const trimmedName = input.name.trim()
      if (trimmedName) {
        nextName = trimmedName
      } else if (typeof input.path === "string") {
        nextName = buildProjectName(nextPath)
      }
    } else if (typeof input.path === "string") {
      nextName = buildProjectName(nextPath)
    }

    const nextSlug =
      nextName !== existing.name ? generateSlug(nextName) : existing.slug

    try {
      const updateData: Prisma.ProjectUpdateInput = {
        name: nextName,
        slug: nextSlug,
        rootPath: nextPath,
        normalizedPath: nextPath,
      }

      if (input.description !== undefined) {
        updateData.description = input.description
      }

      if (input.status !== undefined) {
        updateData.status = input.status
        if (input.status === "archived") {
          updateData.archivedAt = new Date()
        } else if (input.status === "active" && existing.archivedAt) {
          updateData.archivedAt = null
        }
      }

      const project = await prisma.project.update({
        where: { id: trimmedId },
        data: updateData,
      })

      return toDomainProject(project)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          const target = (error.meta?.target as string[]) || []
          if (target.includes("normalizedPath")) {
            throw createProjectError.duplicatePath(nextPath)
          }
        }
      }

      throw createProjectError.dbWriteError("update project", error)
    }
  }

  async function deleteProject(id: string): Promise<boolean> {
    const trimmedId = id.trim()
    if (!trimmedId) {
      throw createProjectError.invalidProjectId("Project ID cannot be empty")
    }

    try {
      await prisma.project.delete({
        where: { id: trimmedId },
      })
      return true
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return false
        }
      }

      throw createProjectError.dbWriteError("delete project", error)
    }
  }

  async function updateProjectLastOpened(id: string): Promise<void> {
    try {
      await prisma.project.update({
        where: { id },
        data: { lastOpenedAt: new Date() },
      })
    } catch {
      // Non-critical update.
    }
  }

  return {
    listProjects,
    getProjectById,
    getProjectByPath,
    addProject,
    updateProject,
    deleteProject,
    updateProjectLastOpened,
  }
}

export type ProjectRepository = ReturnType<typeof createProjectRepository>
