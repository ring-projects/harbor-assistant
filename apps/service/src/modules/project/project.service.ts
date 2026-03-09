import type { Project } from "./types"
import {
  addProject,
  deleteProject,
  getProjectById,
  getProjectByPath,
  listProjects,
  updateProject,
  updateProjectLastOpened,
  getProjectSettings,
  updateProjectSettings,
  listProjectMcpServers,
  upsertProjectMcpServer,
  deleteProjectMcpServer,
} from "./project.repository"
import {
  ProjectServiceError,
  createProjectError,
  isProjectError,
} from "./errors"

/**
 * List all projects
 */
export async function listAllProjects(options?: {
  status?: "active" | "archived" | "missing"
  includeSettings?: boolean
}): Promise<Project[]> {
  try {
    return await listProjects(options)
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to list projects", error)
  }
}

/**
 * Get project by ID
 */
export async function getProject(
  id: string,
  options?: { includeSettings?: boolean },
): Promise<Project> {
  if (!id.trim()) {
    throw createProjectError.invalidProjectId("Project ID is required")
  }

  try {
    const project = await getProjectById(id, options)
    if (!project) {
      throw createProjectError.projectNotFound(id)
    }
    return project
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to get project", error)
  }
}

/**
 * Create new project
 */
export async function createProject(input: {
  path: string
  name?: string
  description?: string
}): Promise<Project> {
  if (!input.path.trim()) {
    throw createProjectError.invalidPath("Project path is required")
  }

  try {
    return await addProject(input)
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to create project", error)
  }
}

/**
 * Update existing project
 */
export async function modifyProject(input: {
  id: string
  path?: string
  name?: string
  description?: string
  status?: "active" | "archived" | "missing"
}): Promise<Project> {
  if (!input.id.trim()) {
    throw createProjectError.invalidProjectId("Project ID is required")
  }

  try {
    const project = await updateProject(input)
    if (!project) {
      throw createProjectError.projectNotFound(input.id)
    }
    return project
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to update project", error)
  }
}

/**
 * Archive project
 */
export async function archiveProject(id: string): Promise<Project> {
  return modifyProject({ id, status: "archived" })
}

/**
 * Restore archived project
 */
export async function restoreProject(id: string): Promise<Project> {
  return modifyProject({ id, status: "active" })
}

/**
 * Delete project
 */
export async function removeProject(id: string): Promise<void> {
  if (!id.trim()) {
    throw createProjectError.invalidProjectId("Project ID is required")
  }

  try {
    const deleted = await deleteProject(id)
    if (!deleted) {
      throw createProjectError.projectNotFound(id)
    }
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to delete project", error)
  }
}

/**
 * Mark project as opened
 */
export async function markProjectOpened(id: string): Promise<void> {
  try {
    await updateProjectLastOpened(id)
  } catch (error) {
    // Non-critical operation, log but don't throw
    console.error(`Failed to update project last opened: ${String(error)}`)
  }
}

/**
 * Get project settings
 */
export async function getSettings(projectId: string) {
  try {
    const settings = await getProjectSettings(projectId)
    if (!settings) {
      throw createProjectError.settingsNotFound(projectId)
    }
    return settings
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to get project settings", error)
  }
}

/**
 * Update project settings
 */
export async function modifySettings(input: {
  projectId: string
  defaultExecutor?: string
  defaultModel?: string
  maxConcurrentTasks?: number
  logRetentionDays?: number
  eventRetentionDays?: number
}) {
  try {
    return await updateProjectSettings(input)
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to update project settings", error)
  }
}

/**
 * Get project MCP servers
 */
export async function getMcpServers(projectId: string) {
  try {
    return await listProjectMcpServers(projectId)
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to get project MCP servers", error)
  }
}

/**
 * Add or update project MCP server
 */
export async function setMcpServer(input: {
  projectId: string
  serverName: string
  enabled: boolean
  source?: string
}) {
  try {
    return await upsertProjectMcpServer(input)
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to set project MCP server", error)
  }
}

/**
 * Remove project MCP server
 */
export async function removeMcpServer(
  projectId: string,
  serverName: string,
): Promise<void> {
  try {
    const deleted = await deleteProjectMcpServer(projectId, serverName)
    if (!deleted) {
      throw createProjectError.mcpServerNotFound(projectId, serverName)
    }
  } catch (error) {
    if (isProjectError(error)) {
      throw new ProjectServiceError(error.code, error.message, error.details)
    }
    throw createProjectError.internalError("Failed to remove project MCP server", error)
  }
}

// Export error class
export { ProjectServiceError }
