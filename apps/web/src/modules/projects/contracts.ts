import type { Project, ProjectSettings } from "@/modules/projects/types"

export type ProjectApiError = {
  code: string
  message: string
}

export type ProjectApiResult = {
  ok: boolean
  projects: Project[]
  error?: ProjectApiError
}

export type ProjectSettingsApiResult = {
  ok: boolean
  settings: ProjectSettings
  error?: ProjectApiError
}
