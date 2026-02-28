import type { Project } from "@/services/project/types"

export type ProjectApiError = {
  code: string
  message: string
}

export type ProjectApiResult = {
  ok: boolean
  projects: Project[]
  error?: ProjectApiError
}
