import { ERROR_CODES } from "@/constants"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import { asRecord, parseJsonResponse, pickString } from "@/lib/protocol"
import { type AgentCapabilityResult } from "@/modules/tasks/contracts"

import { TaskApiClientError } from "./task-api-client"
import { extractAgentCapabilities } from "./agent-payload"

type AgentCapabilitiesEnvelope = {
  ok?: boolean
  capabilities?: unknown
  error?: {
    code?: string
    message?: string
  }
} & Record<string, unknown>

export async function readAgentCapabilities(): Promise<AgentCapabilityResult> {
  const response = await fetch(buildExecutorApiUrl("/v1/agents/capabilities"), {
    method: "GET",
    cache: "no-store",
  })

  const payload = await parseJsonResponse<AgentCapabilitiesEnvelope>(response)
  const error = asRecord(payload?.error)

  if (!response.ok || payload?.ok === false) {
    throw new TaskApiClientError(
      pickString(error, "message") ?? "Failed to load agent capabilities.",
      {
        code: pickString(error, "code") ?? ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  const capabilities = extractAgentCapabilities(payload?.capabilities)
  if (!capabilities) {
    throw new TaskApiClientError("Agent capabilities payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return capabilities
}
