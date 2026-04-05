import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { executorApiFetch } from "@/lib/executor-service-url"
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
import type {
  GitHubInstallation,
  GitHubRepository,
  Project,
  ProjectRepositoryBinding,
  ProjectSettings,
  ProjectSource,
} from "@/modules/projects/types"

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

export type GitHubRepositoryBindingInput = {
  provider: "github"
  installationId: string
  repositoryFullName: string
}

export type CreateProjectInput = {
  name: string
  description?: string | null
} & (
  | {
      source: {
        type: "rootPath"
        rootPath: string
      }
    }
  | {
      source: {
        type: "git"
        repositoryUrl: string
        branch?: string | null
      }
      repositoryBinding?: GitHubRepositoryBindingInput
    }
)

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

export type ProvisionProjectWorkspaceResult = {
  project: Project
  repositoryBinding: ProjectRepositoryBinding
}

export type SyncProjectWorkspaceResult = {
  projectId: string
  syncedAt: string
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

export type BindProjectRepositoryInput = {
  projectId: string
  repositoryBinding: GitHubRepositoryBindingInput
}

async function parseJson(
  response: Response,
): Promise<ProjectEnvelopePayload | null> {
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

function isInstallationAccountType(
  value: string | null,
): value is GitHubInstallation["accountType"] {
  return value === "user" || value === "organization"
}

function isInstallationTargetType(
  value: string | null,
): value is GitHubInstallation["targetType"] {
  return value === "selected" || value === "all"
}

function isInstallationStatus(
  value: string | null,
): value is GitHubInstallation["status"] {
  return value === "active" || value === "suspended" || value === "deleted"
}

function isRepositoryVisibility(
  value: string | null,
): value is GitHubRepository["visibility"] {
  return (
    value === null ||
    value === "public" ||
    value === "private" ||
    value === "internal"
  )
}

function isRepositoryWorkspaceState(
  value: string | null,
): value is ProjectRepositoryBinding["workspaceState"] {
  return value === "unprovisioned" || value === "ready"
}

function extractGitHubInstallation(
  candidate: unknown,
): GitHubInstallation | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const id = toStringOrNull(source.id)
  const accountType = toStringOrNull(source.accountType)
  const accountLogin = toStringOrNull(source.accountLogin)
  const targetType = toStringOrNull(source.targetType)
  const status = toStringOrNull(source.status)

  if (
    !id ||
    !accountLogin ||
    !isInstallationAccountType(accountType) ||
    !isInstallationTargetType(targetType) ||
    !isInstallationStatus(status)
  ) {
    return null
  }

  return {
    id,
    accountType,
    accountLogin,
    targetType,
    status,
  }
}

function extractGitHubRepository(candidate: unknown): GitHubRepository | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const nodeId = toStringOrNull(source.nodeId)
  const owner = toStringOrNull(source.owner)
  const name = toStringOrNull(source.name)
  const fullName = toStringOrNull(source.fullName)
  const url = toStringOrNull(source.url)
  const visibility = toStringOrNull(source.visibility)

  if (
    !nodeId ||
    !owner ||
    !name ||
    !fullName ||
    !url ||
    !isRepositoryVisibility(visibility)
  ) {
    return null
  }

  return {
    nodeId,
    owner,
    name,
    fullName,
    url,
    defaultBranch: toStringOrNull(source.defaultBranch),
    visibility,
  }
}

function extractProjectRepositoryBinding(
  candidate: unknown,
): ProjectRepositoryBinding | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const projectId = toStringOrNull(source.projectId)
  const provider = toStringOrNull(source.provider)
  const installationId = toStringOrNull(source.installationId)
  const repositoryOwner = toStringOrNull(source.repositoryOwner)
  const repositoryName = toStringOrNull(source.repositoryName)
  const repositoryFullName = toStringOrNull(source.repositoryFullName)
  const repositoryUrl = toStringOrNull(source.repositoryUrl)
  const visibility = toStringOrNull(source.visibility)
  const workspaceState = toStringOrNull(source.workspaceState)

  if (
    !projectId ||
    provider !== "github" ||
    !installationId ||
    !repositoryOwner ||
    !repositoryName ||
    !repositoryFullName ||
    !repositoryUrl ||
    !isRepositoryVisibility(visibility) ||
    !isRepositoryWorkspaceState(workspaceState)
  ) {
    return null
  }

  return {
    projectId,
    provider,
    installationId,
    repositoryOwner,
    repositoryName,
    repositoryFullName,
    repositoryUrl,
    defaultBranch: toStringOrNull(source.defaultBranch),
    visibility,
    workspaceState,
  }
}

function extractProjectSource(candidate: unknown): ProjectSource | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const type = toStringOrNull(source.type)
  if (type === "rootPath") {
    const rootPath = toStringOrNull(source.rootPath)
    const normalizedPath = toStringOrNull(source.normalizedPath)
    if (!rootPath || !normalizedPath) {
      return null
    }

    return {
      type,
      rootPath,
      normalizedPath,
    }
  }

  if (type === "git") {
    const repositoryUrl = toStringOrNull(source.repositoryUrl)
    if (!repositoryUrl) {
      return null
    }

    return {
      type,
      repositoryUrl,
      branch: toStringOrNull(source.branch),
    }
  }

  return null
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
  const projectSource = extractProjectSource(source.source)

  if (
    !id ||
    !slug ||
    !name ||
    (status !== "active" && status !== "archived" && status !== "missing") ||
    !settings ||
    !projectSource
  ) {
    return null
  }

  return {
    id,
    slug,
    name,
    description: toStringOrNull(source.description),
    source: projectSource,
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

function extractInstallUrlPayload(payload: unknown): string | null {
  return pickString(asRecord(payload), "installUrl")
}

function extractGitHubInstallationsPayload(
  payload: unknown,
): GitHubInstallation[] | null {
  const source = asRecord(payload)
  if (!source || !Array.isArray(source.installations)) {
    return null
  }

  return source.installations
    .map((item) => extractGitHubInstallation(item))
    .filter((item): item is GitHubInstallation => item !== null)
}

function extractGitHubRepositoriesPayload(
  payload: unknown,
): GitHubRepository[] | null {
  const source = asRecord(payload)
  if (!source || !Array.isArray(source.repositories)) {
    return null
  }

  return source.repositories
    .map((item) => extractGitHubRepository(item))
    .filter((item): item is GitHubRepository => item !== null)
}

function extractProjectRepositoryBindingPayload(
  payload: unknown,
): ProjectRepositoryBinding | null {
  const source = asRecord(payload)
  if (!source) {
    return null
  }

  return extractProjectRepositoryBinding(source.repositoryBinding)
}

function extractProvisionProjectWorkspacePayload(
  payload: unknown,
): ProvisionProjectWorkspaceResult | null {
  const source = asRecord(payload)
  if (!source) {
    return null
  }

  const project = extractProject(source.project)
  const repositoryBinding = extractProjectRepositoryBinding(
    source.repositoryBinding,
  )

  if (!project || !repositoryBinding) {
    return null
  }

  return {
    project,
    repositoryBinding,
  }
}

function extractSyncProjectWorkspacePayload(
  payload: unknown,
): SyncProjectWorkspaceResult | null {
  const source = asRecord(payload)
  if (!source) {
    return null
  }

  const projectId = toStringOrNull(source.projectId)
  if (!projectId) {
    return null
  }

  return {
    projectId,
    syncedAt: toIsoDateString(source.syncedAt),
  }
}

export async function readProjects(): Promise<Project[]> {
  const response = await executorApiFetch("/v1/projects", {
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

export async function createProject(
  input: CreateProjectInput,
): Promise<Project> {
  const body =
    input.source.type === "git"
      ? {
          id: crypto.randomUUID(),
          name: input.name,
          description: input.description,
          source: input.source,
          repositoryBinding:
            "repositoryBinding" in input ? input.repositoryBinding : undefined,
        }
      : {
          id: crypto.randomUUID(),
          name: input.name,
          description: input.description,
          source: input.source,
        }

  const response = await executorApiFetch("/v1/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(body),
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

export async function readGitHubAppInstallUrl(
  returnTo?: string | null,
): Promise<string> {
  const searchParams = new URLSearchParams()
  if (returnTo?.trim()) {
    searchParams.set("returnTo", returnTo)
  }

  const response = await executorApiFetch(
    `/v1/integrations/github/app/install-url${searchParams.size ? `?${searchParams}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load GitHub App install URL.")

  const installUrl = extractInstallUrlPayload(payload)
  if (!installUrl) {
    throw new ProjectApiClientError(
      "GitHub App install URL payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  return installUrl
}

export async function readGitHubInstallations(): Promise<GitHubInstallation[]> {
  const response = await executorApiFetch(
    "/v1/integrations/github/installations",
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load GitHub installations.")

  const installations = extractGitHubInstallationsPayload(payload)
  if (!installations) {
    throw new ProjectApiClientError(
      "GitHub installations payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  return installations
}

export async function readGitHubInstallationRepositories(
  installationId: string,
): Promise<GitHubRepository[]> {
  const response = await executorApiFetch(
    `/v1/integrations/github/installations/${encodeURIComponent(installationId)}/repositories`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load GitHub repositories.")

  const repositories = extractGitHubRepositoriesPayload(payload)
  if (!repositories) {
    throw new ProjectApiClientError("GitHub repositories payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return repositories
}

export async function bindProjectRepository(
  input: BindProjectRepositoryInput,
): Promise<ProjectRepositoryBinding> {
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(input.projectId)}/repository-binding`,
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(input.repositoryBinding),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(
    response,
    payload,
    "Failed to connect project repository access.",
  )

  const repositoryBinding = extractProjectRepositoryBindingPayload(payload)
  if (!repositoryBinding) {
    throw new ProjectApiClientError(
      "Project repository binding payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  return repositoryBinding
}

export async function updateProject(
  input: UpdateProjectInput,
): Promise<Project> {
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(input.id)}`,
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

export async function readProjectRepositoryBinding(
  projectId: string,
): Promise<ProjectRepositoryBinding> {
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(projectId)}/repository-binding`,
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load project repository binding.")

  const repositoryBinding = extractProjectRepositoryBindingPayload(payload)
  if (!repositoryBinding) {
    throw new ProjectApiClientError(
      "Project repository binding payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  return repositoryBinding
}

export async function readProject(projectId: string): Promise<Project> {
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(projectId)}`,
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

export async function readProjectSettings(
  projectId: string,
): Promise<ProjectSettings> {
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(projectId)}/settings`,
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
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(input.projectId)}/settings`,
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

export async function provisionProjectWorkspace(
  projectId: string,
): Promise<ProvisionProjectWorkspaceResult> {
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(projectId)}/provision-workspace`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to provision project workspace.")

  const result = extractProvisionProjectWorkspacePayload(payload)
  if (!result) {
    throw new ProjectApiClientError(
      "Provision project workspace payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  return result
}

export async function syncProjectWorkspace(
  projectId: string,
): Promise<SyncProjectWorkspaceResult> {
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(projectId)}/sync`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to sync project workspace.")

  const result = extractSyncProjectWorkspacePayload(payload)
  if (!result) {
    throw new ProjectApiClientError(
      "Sync project workspace payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  return result
}

export async function archiveProject(
  input: ArchiveProjectInput,
): Promise<Project> {
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(input.projectId)}/archive`,
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

export async function restoreProject(
  input: ArchiveProjectInput,
): Promise<Project> {
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(input.projectId)}/restore`,
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
  const response = await executorApiFetch(
    `/v1/projects/${encodeURIComponent(input.projectId)}`,
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
