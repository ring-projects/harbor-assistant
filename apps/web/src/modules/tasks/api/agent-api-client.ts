import { ERROR_CODES } from "@/constants"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import {
  agentCapabilityResultSchema,
  type AgentCapabilityResult,
} from "@/modules/tasks/contracts"

import { TaskApiClientError } from "./task-api-client"

type AgentCapabilitiesEnvelope = {
  ok?: boolean
  capabilities?: unknown
  error?: {
    code?: string
    message?: string
  }
}

export async function readAgentCapabilities(): Promise<AgentCapabilityResult> {
  const response = await fetch(buildExecutorApiUrl("/v1/agents/capabilities"), {
    method: "GET",
    cache: "no-store",
  })

  const payload = (await response
    .json()
    .catch(() => null)) as AgentCapabilitiesEnvelope | null

  if (!response.ok || payload?.ok === false) {
    throw new TaskApiClientError(
      payload?.error?.message ?? "Failed to load agent capabilities.",
      {
        code: payload?.error?.code ?? ERROR_CODES.INTERNAL_ERROR,
        status: response.status,
      },
    )
  }

  const parsed = agentCapabilityResultSchema.safeParse(payload?.capabilities)
  if (!parsed.success) {
    throw new TaskApiClientError("Agent capabilities payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return parsed.data
}
