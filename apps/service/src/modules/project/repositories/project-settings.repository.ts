import type { Prisma } from "@prisma/client"

import type { ProjectDbClient } from "./project.repository"
import { createProjectError } from "../errors"

export type UpdateProjectSettingsInput = {
  projectId: string
  defaultExecutor?: string | null
  defaultModel?: string | null
  defaultExecutionMode?: string | null
  maxConcurrentTasks?: number
  logRetentionDays?: number | null
  eventRetentionDays?: number | null
  harborSkillsEnabled?: boolean
  harborSkillProfile?: string | null
}

export function createProjectSettingsRepository(prisma: ProjectDbClient) {
  async function getProjectSettings(projectId: string) {
    try {
      return await prisma.projectSetting.findUnique({
        where: { projectId },
      })
    } catch (error) {
      throw createProjectError.dbReadError("get project settings", error)
    }
  }

  async function updateProjectSettings(input: UpdateProjectSettingsInput) {
    try {
      return await prisma.projectSetting.upsert({
        where: { projectId: input.projectId },
        create: {
          projectId: input.projectId,
          defaultExecutor: input.defaultExecutor ?? "codex",
          defaultModel: input.defaultModel ?? null,
          defaultExecutionMode: input.defaultExecutionMode ?? "safe",
          maxConcurrentTasks: input.maxConcurrentTasks ?? 1,
          logRetentionDays: input.logRetentionDays ?? 30,
          eventRetentionDays: input.eventRetentionDays ?? 7,
          harborSkillsEnabled: input.harborSkillsEnabled ?? true,
          harborSkillProfile: input.harborSkillProfile ?? "default",
        },
        update: {
          defaultExecutor: input.defaultExecutor,
          defaultModel: input.defaultModel,
          defaultExecutionMode: input.defaultExecutionMode,
          maxConcurrentTasks: input.maxConcurrentTasks,
          logRetentionDays: input.logRetentionDays,
          eventRetentionDays: input.eventRetentionDays,
          harborSkillsEnabled: input.harborSkillsEnabled,
          harborSkillProfile: input.harborSkillProfile,
        },
      })
    } catch (error) {
      throw createProjectError.dbWriteError("update project settings", error)
    }
  }

  return {
    getProjectSettings,
    updateProjectSettings,
  }
}

export type ProjectSettingsRepository = ReturnType<
  typeof createProjectSettingsRepository
>
