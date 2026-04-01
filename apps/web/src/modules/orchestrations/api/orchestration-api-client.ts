import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import {
  asRecord,
  parseJsonResponse,
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
import type { TaskDetail, TaskEffort } from "@/modules/tasks/contracts"
import { type TaskInput } from "@/modules/tasks/lib"
import { extractSingleTask } from "@/modules/tasks/api/task-payload"

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
}

export type BootstrapOrchestrationInput = {
  projectId: string
  orchestration: {
    title: string
    description?: string | null
  }
  initialTask: {
    prompt?: string
    items?: Extract<TaskInput, readonly unknown[]>
    title?: string
    model: string
    executor: string
    executionMode: "safe" | "connected" | "full-access"
    effort: TaskEffort
  }
}

export type BootstrapOrchestrationResult = {
  orchestration: OrchestrationDetail
  task: TaskDetail
  bootstrap: {
    runtimeStarted: boolean
    warning: {
      code: string
      message: string
    } | null
  }
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

  const id = toStringOrNull(source.id)
  const projectId = toStringOrNull(source.projectId)
  const title = toStringOrNull(source.title)
  const status = toOrchestrationStatus(source.status)

  if (!id || !projectId || !title || !status) {
    return null
  }

  const parsed = orchestrationListItemSchema.safeParse({
    id,
    projectId,
    title,
    description: toStringOrNull(source.description),
    status,
    archivedAt: toOptionalIsoDateString(source.archivedAt),
    createdAt: toIsoDateString(source.createdAt),
    updatedAt: toIsoDateString(source.updatedAt),
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

export async function bootstrapOrchestration(
  input: BootstrapOrchestrationInput,
): Promise<BootstrapOrchestrationResult> {
  const response = await fetch(buildExecutorApiUrl("/v1/orchestrations/bootstrap"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      projectId: input.projectId,
      orchestration: input.orchestration,
      initialTask: input.initialTask.items
        ? {
            ...input.initialTask,
            items: input.initialTask.items,
          }
        : {
            ...input.initialTask,
            prompt: input.initialTask.prompt,
          },
    }),
  })

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to bootstrap orchestration.")

  const orchestration = extractSingleOrchestration(payload)
  if (!orchestration) {
    throw new OrchestrationApiClientError(
      "Bootstrap orchestration payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  const task = extractSingleTask(payload)
  if (!task) {
    throw new OrchestrationApiClientError(
      "Bootstrap task payload is invalid.",
      {
        code: ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  const source = asRecord(payload?.bootstrap)
  const runtimeStarted = typeof source?.runtimeStarted === "boolean"
    ? source.runtimeStarted
    : true
  const warningSource = asRecord(source?.warning)

  return {
    orchestration,
    task,
    bootstrap: {
      runtimeStarted,
      warning:
        warningSource &&
        typeof warningSource.code === "string" &&
        typeof warningSource.message === "string"
          ? {
              code: warningSource.code,
              message: warningSource.message,
            }
          : null,
    },
  }
}
