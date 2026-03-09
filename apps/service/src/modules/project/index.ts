// Types
export type {
  Project,
  ProjectStatus,
  ProjectWithSettings,
  ProjectSettings,
  ProjectMcpServer,
} from "./types"

// Errors
export {
  ProjectError,
  ProjectRepositoryError,
  ProjectServiceError,
  ProjectValidationError,
  PROJECT_ERROR_CODES,
  PROJECT_ERROR_MESSAGES,
  createProjectError,
  isProjectError,
  isProjectRepositoryError,
  isProjectServiceError,
  isProjectValidationError,
} from "./errors"
export type { ProjectErrorCode } from "./errors"

// Repository
export {
  listProjects,
  getProjectById,
  getProjectByPath,
  addProject,
  updateProject,
  deleteProject,
  updateProjectLastOpened,
  getProjectSettings,
  updateProjectSettings,
  listProjectMcpServers,
  upsertProjectMcpServer,
  deleteProjectMcpServer,
} from "./project.repository"

// Service
export {
  listAllProjects,
  getProject,
  createProject,
  modifyProject,
  archiveProject,
  restoreProject,
  removeProject,
  markProjectOpened,
  getSettings,
  modifySettings,
  getMcpServers,
  setMcpServer,
  removeMcpServer,
} from "./project.service"
