export type {
  Project,
  ProjectStatus,
  ProjectWithSettings,
  ProjectSettings,
} from "./types"

export {
  ProjectError,
  createProjectError,
} from "./errors"
export type { ProjectErrorCode } from "./errors"

export {
  createProjectRepository,
  createProjectSettingsRepository,
} from "./repositories"
export type {
  AddProjectInput,
  ListProjectsOptions,
  ProjectDbClient,
  ProjectRepository,
  ProjectSettingsRepository,
  UpdateProjectInput,
  UpdateProjectSettingsInput,
} from "./repositories"

export {
  createProjectService,
  createProjectSettingsService,
} from "./services"
export type {
  ProjectService,
  ProjectSettingsService,
} from "./services"

export { registerProjectModuleRoutes } from "./routes"

import {
  createProjectRepository,
  createProjectSettingsRepository,
} from "./repositories"
import type { ProjectDbClient } from "./repositories"
import {
  createProjectService,
  createProjectSettingsService,
} from "./services"

export function createProjectModule(args: { prisma: ProjectDbClient }) {
  const projectRepository = createProjectRepository(args.prisma)
  const projectSettingsRepository = createProjectSettingsRepository(args.prisma)

  const projectService = createProjectService({
    projectRepository,
  })
  const projectSettingsService = createProjectSettingsService({
    projectSettingsRepository,
  })

  return {
    repositories: {
      projectRepository,
      projectSettingsRepository,
    },
    services: {
      projectService,
      projectSettingsService,
    },
  }
}
