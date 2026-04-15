import { createServerFn, getGlobalStartContext } from "@tanstack/react-start"

import { ERROR_CODES } from "@/constants"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import { parseJsonResponse, toStringOrNull } from "@/lib/protocol"
import { ProjectApiClientError } from "@/modules/projects/api"
import { buildForwardHeaders } from "@/modules/auth/server/auth-proxy"

type ProjectListEnvelope = {
  ok?: boolean
  error?: {
    code?: unknown
    message?: unknown
  }
  projects?: unknown[]
}

function readFirstProjectId(payload: ProjectListEnvelope | null) {
  if (!Array.isArray(payload?.projects)) {
    return null
  }

  for (const project of payload.projects) {
    if (!project || typeof project !== "object") {
      continue
    }

    const projectId = toStringOrNull((project as { id?: unknown }).id)
    if (projectId) {
      return projectId
    }
  }

  return null
}

export const readHomeProjectRedirect = createServerFn({
  method: "GET",
}).handler(async () => {
  const startContext = getGlobalStartContext() as
    | { request?: Request }
    | undefined

  if (!startContext?.request) {
    throw new Error("Request context is unavailable for project redirect lookup.")
  }

  const response = await fetch(buildExecutorApiUrl("/v1/projects"), {
    method: "GET",
    cache: "no-store",
    headers: buildForwardHeaders(startContext.request),
  })

  const payload = await parseJsonResponse<ProjectListEnvelope>(response)

  if (!response.ok || payload?.ok === false) {
    throw new ProjectApiClientError(
      toStringOrNull(payload?.error?.message) ?? "Failed to load projects.",
      {
        status: response.status,
        code:
          toStringOrNull(payload?.error?.code) ?? ERROR_CODES.INTERNAL_ERROR,
      },
    )
  }

  const firstProjectId = readFirstProjectId(payload)

  return firstProjectId ? `/${firstProjectId}` : "/projects/new"
})
