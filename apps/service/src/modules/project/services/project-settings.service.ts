import { createProjectError, ProjectError } from "../errors"
import type {
  ProjectSettingsRepository,
  UpdateProjectSettingsInput,
} from "../repositories"

export function createProjectSettingsService(args: {
  projectSettingsRepository: ProjectSettingsRepository
}) {
  const { projectSettingsRepository } = args

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
      return await projectSettingsRepository.updateProjectSettings(input)
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
