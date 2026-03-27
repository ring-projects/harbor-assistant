import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import { asRecord, parseJsonResponse } from "@/lib/protocol"
import { gitDiffSchema, type GitDiff } from "@/modules/git/contracts"

const gitApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
})

type GitApiError = z.infer<typeof gitApiErrorSchema>

type GitEnvelopePayload = {
  ok?: boolean
  error?: GitApiError
} & Record<string, unknown>

export class GitApiClientError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "GitApiClientError"
    this.code = options?.code ?? ERROR_CODES.INTERNAL_ERROR
    this.status = options?.status ?? 500
  }
}

async function parseJson(response: Response): Promise<GitEnvelopePayload | null> {
  return parseJsonResponse<GitEnvelopePayload>(response)
}

function throwIfFailed(
  response: Response,
  payload: GitEnvelopePayload | null,
  fallbackMessage: string,
) {
  const parsedError = gitApiErrorSchema.safeParse(payload?.error)

  if (response.ok && payload?.ok !== false) {
    return
  }

  throw new GitApiClientError(
    parsedError.success ? parsedError.data.message : fallbackMessage,
    {
      status: response.status,
      code: parsedError.success
        ? parsedError.data.code
        : ERROR_CODES.INTERNAL_ERROR,
    },
  )
}

function extractDiff(payload: unknown): GitDiff | null {
  const source = asRecord(payload)
  if (!source) {
    return null
  }

  const root =
    source.diff && typeof source.diff === "object" ? asRecord(source.diff) : source
  if (!root) {
    return null
  }

  const parsed = gitDiffSchema.safeParse({
    projectId: root.projectId,
    files: Array.isArray(root.files) ? root.files : [],
  })

  return parsed.success ? parsed.data : null
}

export async function readProjectGitDiff(projectId: string): Promise<GitDiff> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/projects/${encodeURIComponent(projectId)}/git/diff`),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load git diff.")

  const diff = extractDiff(payload)
  if (!diff) {
    throw new GitApiClientError("Git diff payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return diff
}
