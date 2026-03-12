import type { Project } from "../types"
import { createProjectError, ProjectError } from "../errors"
import type {
  AddProjectInput,
  ListProjectsOptions,
  ProjectRepository,
  UpdateProjectInput,
} from "../repositories"
import type { ProjectSettingsRepository } from "../repositories"
import type { ProjectSkillBridgeService } from "./project-skill-bridge.service"

export function createProjectService(args: {
  projectRepository: ProjectRepository
  projectSettingsRepository?: Pick<ProjectSettingsRepository, "getProjectSettings">
  projectSkillBridgeService?: Pick<
    ProjectSkillBridgeService,
    "ensureProjectSkillBridge" | "removeProjectSkillBridgeAtProjectPath"
  >
}) {
  const {
    projectRepository,
    projectSettingsRepository,
    projectSkillBridgeService,
  } = args

  async function listProjects(options?: ListProjectsOptions): Promise<Project[]> {
    try {
      return await projectRepository.listProjects(options)
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw createProjectError.internalError("Failed to list projects", error)
    }
  }

  async function getProject(
    id: string,
    options?: { includeSettings?: boolean },
  ): Promise<Project> {
    if (!id.trim()) {
      throw createProjectError.invalidProjectId("Project ID is required")
    }

    try {
      const project = await projectRepository.getProjectById(id, options)
      if (!project) {
        throw createProjectError.projectNotFound(id)
      }
      return project
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw createProjectError.internalError("Failed to get project", error)
    }
  }

  async function createProject(input: AddProjectInput): Promise<Project> {
    if (!input.path.trim()) {
      throw createProjectError.invalidPath("Project path is required")
    }

    try {
      const project = await projectRepository.addProject(input)
      const settings = await projectSettingsRepository?.getProjectSettings(project.id)
      if (settings?.harborSkillsEnabled && projectSkillBridgeService) {
        await projectSkillBridgeService.ensureProjectSkillBridge({
          projectId: project.id,
          profile: settings.harborSkillProfile,
        })
      }

      return project
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw createProjectError.internalError("Failed to create project", error)
    }
  }

  async function updateProject(input: UpdateProjectInput): Promise<Project> {
    if (!input.id.trim()) {
      throw createProjectError.invalidProjectId("Project ID is required")
    }

    try {
      const existingProject = await projectRepository.getProjectById(input.id)
      const project = await projectRepository.updateProject(input)
      if (!project) {
        throw createProjectError.projectNotFound(input.id)
      }

      if (
        existingProject &&
        existingProject.path !== project.path &&
        projectSkillBridgeService
      ) {
        await projectSkillBridgeService.removeProjectSkillBridgeAtProjectPath(
          existingProject.path,
        )
      }

      const settings = await projectSettingsRepository?.getProjectSettings(project.id)
      if (settings?.harborSkillsEnabled && projectSkillBridgeService) {
        await projectSkillBridgeService.ensureProjectSkillBridge({
          projectId: project.id,
          profile: settings.harborSkillProfile,
        })
      }

      return project
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw createProjectError.internalError("Failed to update project", error)
    }
  }

  async function archiveProject(id: string): Promise<Project> {
    return updateProject({ id, status: "archived" })
  }

  async function restoreProject(id: string): Promise<Project> {
    return updateProject({ id, status: "active" })
  }

  async function removeProject(id: string): Promise<void> {
    if (!id.trim()) {
      throw createProjectError.invalidProjectId("Project ID is required")
    }

    try {
      const existingProject = await projectRepository.getProjectById(id)
      const deleted = await projectRepository.deleteProject(id)
      if (!deleted) {
        throw createProjectError.projectNotFound(id)
      }

      if (existingProject && projectSkillBridgeService) {
        await projectSkillBridgeService.removeProjectSkillBridgeAtProjectPath(
          existingProject.path,
        )
      }
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw createProjectError.internalError("Failed to delete project", error)
    }
  }

  async function markProjectOpened(id: string): Promise<void> {
    try {
      await projectRepository.updateProjectLastOpened(id)
    } catch (error) {
      console.error(`Failed to update project last opened: ${String(error)}`)
    }
  }

  return {
    listProjects,
    getProject,
    createProject,
    updateProject,
    archiveProject,
    restoreProject,
    removeProject,
    markProjectOpened,
  }
}

export type ProjectService = ReturnType<typeof createProjectService>
