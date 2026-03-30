import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import {
  asRecord,
  parseJsonResponse,
  pickString,
  toBooleanOrNull,
  toIntegerOrNull,
  toIsoDateString,
  toOptionalIsoDateString,
  toStringOrNull,
} from "@/lib/protocol"
import type { Project, ProjectSettings } from "@/modules/projects/types"

const projectApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
})

type ProjectApiError = z.infer<typeof projectApiErrorSchema>

type ProjectEnvelopePayload = {
  ok?: boolean
  error?: ProjectApiError
} & Record<string, unknown>

export class ProjectApiClientError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "ProjectApiClientError"
    this.code = options?.code ?? ERROR_CODES.INTERNAL_ERROR
    this.status = options?.status ?? 500
  }
}

export type CreateProjectInput = {
  name: string
  rootPath: string
  description?: string | null
}

export type UpdateProjectInput = {
  id: string
  name?: string
  description?: string | null
  rootPath?: string
}

export type ArchiveProjectInput = {
  projectId: string
}

export type DeleteProjectInput = {
  projectId: string
}

export type DeleteProjectResult = {
  projectId: string
}

export type UpdateProjectSettingsInput = {
  projectId: string
  retention?: Partial<{
    logRetentionDays: number | null
    eventRetentionDays: number | null
  }>
  skills?: Partial<{
    harborSkillsEnabled: boolean
    harborSkillProfile: string | null
  }>
}

async function parseJson(response: Response): Promise<ProjectEnvelopePayload | null> {
  return parseJsonResponse<ProjectEnvelopePayload>(response)
}

function throwIfFailed(
  response: Response,
  payload: ProjectEnvelopePayload | null,
  fallbackMessage: string,
) {
  const parsedError = projectApiErrorSchema.safeParse(payload?.error)

  if (response.ok && payload?.ok !== false) {
    return
  }

  throw new ProjectApiClientError(
    parsedError.success ? parsedError.data.message : fallbackMessage,
    {
      status: response.status,
      code: parsedError.success
        ? parsedError.data.code
        : ERROR_CODES.INTERNAL_ERROR,
    },
  )
}

function extractProjectSettings(candidate: unknown): ProjectSettings | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const retention = asRecord(source.retention)
  const skills = asRecord(source.skills)

  if (!retention || !skills) {
    return null
  }

  const harborSkillsEnabled = toBooleanOrNull(skills.harborSkillsEnabled)

  if (harborSkillsEnabled === null) {
    return null
  }

  return {
    retention: {
      logRetentionDays: toIntegerOrNull(retention.logRetentionDays),
      eventRetentionDays: toIntegerOrNull(retention.eventRetentionDays),
    },
    skills: {
      harborSkillsEnabled,
      harborSkillProfile: toStringOrNull(skills.harborSkillProfile),
    },
  }
}

function extractProject(candidate: unknown): Project | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const id = toStringOrNull(source.id)
  const slug = toStringOrNull(source.slug)
  const name = toStringOrNull(source.name)
  const rootPath = toStringOrNull(source.rootPath)
  const normalizedPath = toStringOrNull(source.normalizedPath)
  const status = toStringOrNull(source.status)
  const settings = extractProjectSettings(source.settings)

  if (
    !id ||
    !slug ||
    !name ||
    !rootPath ||
    !normalizedPath ||
    (status !== "active" && status !== "archived" && status !== "missing") ||
    !settings
  ) {
    return null
  }

  return {
    id,
    slug,
    name,
    description: toStringOrNull(source.description),
    rootPath,
    normalizedPath,
    status,
    archivedAt: toOptionalIsoDateString(source.archivedAt),
    lastOpenedAt: toOptionalIsoDateString(source.lastOpenedAt),
    createdAt: toIsoDateString(source.createdAt),
    updatedAt: toIsoDateString(source.updatedAt),
    settings,
  }
}

function extractProjectList(payload: unknown): Project[] | null {
  const source = asRecord(payload)
  if (!source || !Array.isArray(source.projects)) {
    return null
  }

  const projects = source.projects
    .map((item) => extractProject(item))
    .filter((item): item is Project => item !== null)

  return projects
}

function extractProjectPayload(payload: unknown): Project | null {
  const source = asRecord(payload)
  if (!source) {
    return null
  }

  return extractProject(source.project)
}

function extractSettingsPayload(payload: unknown): ProjectSettings | null {
  const source = asRecord(payload)
  if (!source) {
    return null
  }

  return extractProjectSettings(source.settings)
}

export async function readProjects(): Promise<Project[]> {
  const response = await fetch(buildExecutorApiUrl("/v1/projects"), {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
    },
  })

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load projects.")

  const projects = extractProjectList(payload)
  if (!projects) {
    throw new ProjectApiClientError("Project list payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return projects
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const response = await fetch(buildExecutorApiUrl("/v1/projects"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      id: crypto.randomUUID(),
      name: input.name,
      rootPath: input.rootPath,
      description: input.description,
    }),
  })

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to create project.")

  const project = extractProjectPayload(payload)
  if (!project) {
    throw new ProjectApiClientError("Create project payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return project
}

export async function updateProject(input: UpdateProjectInput): Promise<Project> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/projects/${encodeURIComponent(input.id)}`),
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        rootPath: input.rootPath,
      }),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to update project.")

  const project = extractProjectPayload(payload)
  if (!project) {
    throw new ProjectApiClientError("Update project payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return project
}

export async function readProject(projectId: string): Promise<Project> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/projects/${encodeURIComponent(projectId)}`),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load project.")

  const project = extractProjectPayload(payload)
  if (!project) {
    throw new ProjectApiClientError("Project payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return project
}

export async function readProjectSettings(projectId: string): Promise<ProjectSettings> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/projects/${encodeURIComponent(projectId)}/settings`),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load project settings.")

  const settings = extractSettingsPayload(payload)
  if (!settings) {
    throw new ProjectApiClientError("Project settings payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return settings
}

export async function updateProjectSettings(
  input: UpdateProjectSettingsInput,
): Promise<Project> {
  const response = await fetch(
    buildExecutorApiUrl(
      `/v1/projects/${encodeURIComponent(input.projectId)}/settings`,
    ),
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        retention: input.retention,
        skills: input.skills,
      }),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to update project settings.")

  const project = extractProjectPayload(payload)
  if (!project) {
    throw new ProjectApiClientError("Update settings payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return project
}

export async function archiveProject(input: ArchiveProjectInput): Promise<Project> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/projects/${encodeURIComponent(input.projectId)}/archive`),
    {
      method: "POST",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to archive project.")

  const project = extractProjectPayload(payload)
  if (!project) {
    throw new ProjectApiClientError("Archive project payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return project
}

export async function restoreProject(input: ArchiveProjectInput): Promise<Project> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/projects/${encodeURIComponent(input.projectId)}/restore`),
    {
      method: "POST",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to restore project.")

  const project = extractProjectPayload(payload)
  if (!project) {
    throw new ProjectApiClientError("Restore project payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return project
}

export async function deleteProject(
  input: DeleteProjectInput,
): Promise<DeleteProjectResult> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/projects/${encodeURIComponent(input.projectId)}`),
    {
      method: "DELETE",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to delete project.")

  const projectId = pickString(payload, "projectId")
  if (!projectId) {
    throw new ProjectApiClientError("Delete project payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return {
    projectId,
  }
}
