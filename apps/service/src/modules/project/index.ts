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
  createProjectSkillBridgeService,
} from "./services"
export type {
  ProjectService,
  ProjectSettingsService,
  ProjectSkillBridgeService,
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
  createProjectSkillBridgeService,
} from "./services"

export function createProjectModule(args: {
  prisma: ProjectDbClient
  harborHomeDirectory: string
}) {
  const projectRepository = createProjectRepository(args.prisma)
  const projectSettingsRepository = createProjectSettingsRepository(args.prisma)
  const projectSkillBridgeService = createProjectSkillBridgeService({
    harborHomeDirectory: args.harborHomeDirectory,
    projectRepository,
  })

  const projectService = createProjectService({
    projectRepository,
    projectSettingsRepository,
    projectSkillBridgeService,
  })
  const projectSettingsService = createProjectSettingsService({
    projectSettingsRepository,
    projectSkillBridgeService,
  })

  return {
    repositories: {
      projectRepository,
      projectSettingsRepository,
    },
    services: {
      projectService,
      projectSettingsService,
      projectSkillBridgeService,
    },
  }
}
