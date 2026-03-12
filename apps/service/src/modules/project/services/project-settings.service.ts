import { createProjectError, ProjectError } from "../errors"
import type {
  ProjectSettingsRepository,
  UpdateProjectSettingsInput,
} from "../repositories"
import type { ProjectSkillBridgeService } from "./project-skill-bridge.service"

export function createProjectSettingsService(args: {
  projectSettingsRepository: ProjectSettingsRepository
  projectSkillBridgeService?: Pick<
    ProjectSkillBridgeService,
    "ensureProjectSkillBridge" | "removeProjectSkillBridge"
  >
}) {
  const { projectSettingsRepository, projectSkillBridgeService } = args

  async function getSettings(projectId: string) {
    try {
      const settings =
        await projectSettingsRepository.getProjectSettings(projectId) ??
        await projectSettingsRepository.updateProjectSettings({
          projectId,
        })

      if (!settings) {
        throw createProjectError.settingsNotFound(projectId)
      }
      return settings
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw createProjectError.internalError(
        "Failed to get project settings",
        error,
      )
    }
  }

  async function updateSettings(input: UpdateProjectSettingsInput) {
    try {
      const settings = await projectSettingsRepository.updateProjectSettings(input)

      if (projectSkillBridgeService) {
        if (settings.harborSkillsEnabled) {
          await projectSkillBridgeService.ensureProjectSkillBridge({
            projectId: settings.projectId,
            profile: settings.harborSkillProfile,
          })
        } else {
          await projectSkillBridgeService.removeProjectSkillBridge(settings.projectId)
        }
      }

      return settings
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw createProjectError.internalError(
        "Failed to update project settings",
        error,
      )
    }
  }

  return {
    getSettings,
    updateSettings,
  }
}

export type ProjectSettingsService = ReturnType<
  typeof createProjectSettingsService
>
