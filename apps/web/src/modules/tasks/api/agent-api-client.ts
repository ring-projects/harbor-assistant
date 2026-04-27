import { ERROR_CODES } from "@/constants"
import { harborApiFetch } from "@/lib/harbor-api-url"
import { parseJsonResponse } from "@/lib/protocol"
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
  const response = await harborApiFetch("/v1/agents/capabilities", {
    method: "GET",
    cache: "no-store",
  })

  const payload = await parseJsonResponse<AgentCapabilitiesEnvelope>(response)

  if (!response.ok || payload?.ok === false) {
    throw new TaskApiClientError(
      payload?.error?.message ?? "Failed to load agent capabilities.",
      {
        code: payload?.error?.code ?? ERROR_CODES.INTERNAL_ERROR,
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
