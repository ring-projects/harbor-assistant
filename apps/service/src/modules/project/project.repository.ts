import { realpath, stat } from "node:fs/promises"
import path from "node:path"
import { Prisma } from "@prisma/client"

import { getPrismaClient } from "../../lib/prisma"
import type { Project } from "./types"
import {
  ProjectRepositoryError,
  createProjectError,
  PROJECT_ERROR_CODES,
} from "./errors"

/**
 * Resolve and validate project path
 */
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
  } catch (error) {
    throw createProjectError.pathNotFound(absolutePath)
  }

  let pathStats
  try {
    pathStats = await stat(canonicalPath)
  } catch (error) {
    throw createProjectError.pathNotFound(canonicalPath)
  }

  if (!pathStats.isDirectory()) {
    throw createProjectError.notADirectory(canonicalPath)
  }

  return canonicalPath
}

/**
 * Build project name from path
 */
function buildProjectName(canonicalPath: string, explicitName?: string): string {
  const trimmedName = explicitName?.trim()
  if (trimmedName) {
    return trimmedName
  }

  const basename = path.basename(canonicalPath)
  return basename || canonicalPath
}

/**
 * Generate slug from project name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Convert Prisma Project to domain Project
 */
function toDomainProject(prismaProject: any): Project {
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
    // Convenience alias - commonly used throughout the codebase
    path: prismaProject.normalizedPath,
  }
}

/**
 * Project repository error
 */
export { ProjectRepositoryError } from "./errors"

/**
 * List all projects
 */
export async function listProjects(options?: {
  status?: "active" | "archived" | "missing"
  includeSettings?: boolean
}): Promise<Project[]> {
  try {
    const prisma = getPrismaClient()
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

/**
 * Get project by ID
 */
export async function getProjectById(
  id: string,
  options?: { includeSettings?: boolean },
): Promise<Project | null> {
  const trimmedId = id.trim()
  if (!trimmedId) {
    return null
  }

  try {
    const prisma = getPrismaClient()
    const project = await prisma.project.findUnique({
      where: { id: trimmedId },
      include: options?.includeSettings ? { settings: true } : undefined,
    })

    return project ? toDomainProject(project) : null
  } catch (error) {
    throw createProjectError.dbReadError("get project by id", error)
  }
}

/**
 * Get project by path
 */
export async function getProjectByPath(
  normalizedPath: string,
): Promise<Project | null> {
  try {
    const prisma = getPrismaClient()
    const project = await prisma.project.findUnique({
      where: { normalizedPath },
    })

    return project ? toDomainProject(project) : null
  } catch (error) {
    throw createProjectError.dbReadError("get project by path", error)
  }
}

/**
 * Add new project
 */
export async function addProject(input: {
  path: string
  name?: string
  description?: string
}): Promise<Project> {
  const canonicalPath = await resolveProjectPath(input.path)
  const projectName = buildProjectName(canonicalPath, input.name)
  const slug = generateSlug(projectName)

  try {
    const prisma = getPrismaClient()
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
            maxConcurrentTasks: 1,
            logRetentionDays: 30,
            eventRetentionDays: 7,
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

/**
 * Update project
 */
export async function updateProject(input: {
  id: string
  path?: string
  name?: string
  description?: string
  status?: "active" | "archived" | "missing"
}): Promise<Project | null> {
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

  const nextSlug = nextName !== existing.name ? generateSlug(nextName) : existing.slug

  try {
    const prisma = getPrismaClient()
    const updateData: any = {
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

/**
 * Delete project
 */
export async function deleteProject(id: string): Promise<boolean> {
  const trimmedId = id.trim()
  if (!trimmedId) {
    throw createProjectError.invalidProjectId("Project ID cannot be empty")
  }

  try {
    const prisma = getPrismaClient()
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

/**
 * Update project last opened timestamp
 */
export async function updateProjectLastOpened(id: string): Promise<void> {
  try {
    const prisma = getPrismaClient()
    await prisma.project.update({
      where: { id },
      data: { lastOpenedAt: new Date() },
    })
  } catch (error) {
    // Silently fail - this is not critical
  }
}

/**
 * Get project settings
 */
export async function getProjectSettings(projectId: string) {
  try {
    const prisma = getPrismaClient()
    return await prisma.projectSetting.findUnique({
      where: { projectId },
    })
  } catch (error) {
    throw createProjectError.dbReadError("get project settings", error)
  }
}

/**
 * Update project settings
 */
export async function updateProjectSettings(input: {
  projectId: string
  defaultExecutor?: string
  defaultModel?: string
  maxConcurrentTasks?: number
  logRetentionDays?: number
  eventRetentionDays?: number
}) {
  try {
    const prisma = getPrismaClient()
    return await prisma.projectSetting.upsert({
      where: { projectId: input.projectId },
      create: {
        projectId: input.projectId,
        defaultExecutor: input.defaultExecutor ?? "codex",
        defaultModel: input.defaultModel,
        maxConcurrentTasks: input.maxConcurrentTasks ?? 1,
        logRetentionDays: input.logRetentionDays ?? 30,
        eventRetentionDays: input.eventRetentionDays ?? 7,
      },
      update: {
        defaultExecutor: input.defaultExecutor,
        defaultModel: input.defaultModel,
        maxConcurrentTasks: input.maxConcurrentTasks,
        logRetentionDays: input.logRetentionDays,
        eventRetentionDays: input.eventRetentionDays,
      },
    })
  } catch (error) {
    throw createProjectError.dbWriteError("update project settings", error)
  }
}

/**
 * List project MCP servers
 */
export async function listProjectMcpServers(projectId: string) {
  try {
    const prisma = getPrismaClient()
    return await prisma.projectMcpServer.findMany({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
    })
  } catch (error) {
    throw createProjectError.dbReadError("list project MCP servers", error)
  }
}

/**
 * Add or update project MCP server
 */
export async function upsertProjectMcpServer(input: {
  projectId: string
  serverName: string
  enabled: boolean
  source?: string
}) {
  try {
    const prisma = getPrismaClient()
    return await prisma.projectMcpServer.upsert({
      where: {
        projectId_serverName: {
          projectId: input.projectId,
          serverName: input.serverName,
        },
      },
      create: {
        projectId: input.projectId,
        serverName: input.serverName,
        enabled: input.enabled,
        source: input.source,
      },
      update: {
        enabled: input.enabled,
        source: input.source,
      },
    })
  } catch (error) {
    throw createProjectError.dbWriteError("upsert project MCP server", error)
  }
}

/**
 * Delete project MCP server
 */
export async function deleteProjectMcpServer(
  projectId: string,
  serverName: string,
): Promise<boolean> {
  try {
    const prisma = getPrismaClient()
    await prisma.projectMcpServer.delete({
      where: {
        projectId_serverName: {
          projectId,
          serverName,
        },
      },
    })
    return true
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return false
      }
    }

    throw createProjectError.dbWriteError("delete project MCP server", error)
  }
}
