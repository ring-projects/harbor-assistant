import type { Prisma } from "@prisma/client"

import type { ProjectDbClient } from "./project.repository"
import { createProjectError } from "../errors"

export type UpdateProjectSettingsInput = {
  projectId: string
  defaultExecutor?: string
  defaultModel?: string
  maxConcurrentTasks?: number
  logRetentionDays?: number
  eventRetentionDays?: number
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

  return {
    getProjectSettings,
    updateProjectSettings,
  }
}

export type ProjectSettingsRepository = ReturnType<
  typeof createProjectSettingsRepository
>
