import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import {
  asRecord,
  parseJsonResponse,
  pickString,
  toIntegerOrNull,
  toIsoDateString,
  toOptionalIsoDateString,
  toStringOrNull,
} from "@/lib/protocol"
import {
  orchestrationDetailSchema,
  orchestrationListItemSchema,
  type OrchestrationDetail,
  type OrchestrationListItem,
  type OrchestrationStatus,
  ORCHESTRATION_STATUS_VALUES,
} from "@/modules/orchestrations/contracts"

const orchestrationApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
})

type OrchestrationApiError = z.infer<typeof orchestrationApiErrorSchema>

type OrchestrationEnvelopePayload = {
  ok?: boolean
  error?: OrchestrationApiError
} & Record<string, unknown>

const ORCHESTRATION_STATUS_SET = new Set<OrchestrationStatus>(
  ORCHESTRATION_STATUS_VALUES,
)

export class OrchestrationApiClientError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "OrchestrationApiClientError"
    this.code = options?.code ?? ERROR_CODES.INTERNAL_ERROR
    this.status = options?.status ?? 500
  }
}

export type CreateOrchestrationInput = {
  projectId: string
  title: string
  description?: string | null
  defaultPrompt?: string | null
}

async function parseJson(
  response: Response,
): Promise<OrchestrationEnvelopePayload | null> {
  return parseJsonResponse<OrchestrationEnvelopePayload>(response)
}

function throwIfFailed(
  response: Response,
  payload: OrchestrationEnvelopePayload | null,
  fallbackMessage: string,
) {
  const parsedError = orchestrationApiErrorSchema.safeParse(payload?.error)

  if (response.ok && payload?.ok !== false) {
    return
  }

  throw new OrchestrationApiClientError(
    parsedError.success ? parsedError.data.message : fallbackMessage,
    {
      status: response.status,
      code: parsedError.success
        ? parsedError.data.code
        : ERROR_CODES.INTERNAL_ERROR,
    },
  )
}

function toOrchestrationStatus(value: unknown): OrchestrationStatus | null {
  if (typeof value !== "string") {
    return null
  }

  return ORCHESTRATION_STATUS_SET.has(value as OrchestrationStatus)
    ? (value as OrchestrationStatus)
    : null
}

function normalizeOrchestrationCandidate(
  candidate: unknown,
): OrchestrationListItem | null {
  const source = asRecord(candidate)
  if (!source) {
    return null
  }

  const orchestrationId = pickString(
    source,
    "orchestrationId",
    "id",
    "orchestration_id",
  )
  const projectId = pickString(source, "projectId", "project_id")
  const title = toStringOrNull(source.title)
  const status = toOrchestrationStatus(source.status)

  if (!orchestrationId || !projectId || !title || !status) {
    return null
  }

  const parsed = orchestrationListItemSchema.safeParse({
    orchestrationId,
    projectId,
    title,
    description: toStringOrNull(source.description),
    defaultPrompt: toStringOrNull(source.defaultPrompt),
    defaultConfig:
      source.defaultConfig && typeof source.defaultConfig === "object"
        ? source.defaultConfig
        : null,
    status,
    archivedAt: toOptionalIsoDateString(source.archivedAt),
    createdAt: toIsoDateString(source.createdAt),
    updatedAt: toIsoDateString(source.updatedAt),
    taskCount: toIntegerOrNull(source.taskCount) ?? 0,
    activeTaskCount: toIntegerOrNull(source.activeTaskCount) ?? 0,
    latestTaskSummary: toStringOrNull(source.latestTaskSummary),
    latestTaskUpdatedAt: toOptionalIsoDateString(source.latestTaskUpdatedAt, null),
  })

  return parsed.success ? parsed.data : null
}

function extractOrchestrationArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  const source = asRecord(payload)
  if (!source) {
    return []
  }

  for (const candidate of [
    source.orchestrations,
    source.items,
    source.data,
  ]) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  const orchestration = asRecord(source.orchestration)
  return orchestration ? [orchestration] : []
}

function extractOrchestrationList(payload: unknown): OrchestrationListItem[] {
  return extractOrchestrationArray(payload)
    .map((item) => normalizeOrchestrationCandidate(item))
    .filter((item): item is OrchestrationListItem => item !== null)
}

function extractSingleOrchestration(payload: unknown): OrchestrationDetail | null {
  const orchestration = normalizeOrchestrationCandidate(
    extractOrchestrationArray(payload)[0],
  )
  if (!orchestration) {
    return null
  }

  const parsed = orchestrationDetailSchema.safeParse(orchestration)
  return parsed.success ? parsed.data : null
}

export async function readProjectOrchestrations(
  projectId: string,
): Promise<OrchestrationListItem[]> {
  const response = await fetch(
    buildExecutorApiUrl(
      `/v1/projects/${encodeURIComponent(projectId)}/orchestrations`,
    ),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load orchestrations.")

  return extractOrchestrationList(payload)
}

export async function readOrchestration(
  orchestrationId: string,
): Promise<OrchestrationDetail> {
  const response = await fetch(
    buildExecutorApiUrl(
      `/v1/orchestrations/${encodeURIComponent(orchestrationId)}`,
    ),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load orchestration detail.")

  const orchestration = extractSingleOrchestration(payload)
  if (!orchestration) {
    throw new OrchestrationApiClientError(
      "Orchestration detail payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  return orchestration
}

export async function createOrchestration(
  input: CreateOrchestrationInput,
): Promise<OrchestrationDetail> {
  const response = await fetch(buildExecutorApiUrl("/v1/orchestrations"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      defaultPrompt: input.defaultPrompt,
    }),
  })

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to create orchestration.")

  const orchestration = extractSingleOrchestration(payload)
  if (!orchestration) {
    throw new OrchestrationApiClientError(
      "Create orchestration payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  return orchestration
}
