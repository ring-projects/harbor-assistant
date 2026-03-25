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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
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

  const capabilities = asRecord(payload?.capabilities)
  const agents = asRecord(capabilities?.agents)

  const parsed = agentCapabilityResultSchema.safeParse({
    checkedAt:
      typeof capabilities?.checkedAt === "string"
        ? capabilities.checkedAt
        : new Date().toISOString(),
    agents: {
      codex: {
        models: Array.isArray(asRecord(agents?.codex)?.models)
          ? (asRecord(agents?.codex)?.models as unknown[]).map((model) => {
              const record = asRecord(model)
              return {
                id: typeof record?.id === "string" ? record.id : "",
                displayName:
                  typeof record?.name === "string"
                    ? record.name
                    : typeof record?.id === "string"
                      ? record.id
                      : "",
                isDefault: record?.isDefault === true,
              }
            })
          : [],
        supportsResume: asRecord(agents?.codex)?.supportsResume === true,
        supportsStreaming: asRecord(agents?.codex)?.supportsStreaming === true,
      },
      "claude-code": {
        models: Array.isArray(asRecord(agents?.["claude-code"])?.models)
          ? (asRecord(agents?.["claude-code"])?.models as unknown[]).map((model) => {
              const record = asRecord(model)
              return {
                id: typeof record?.id === "string" ? record.id : "",
                displayName:
                  typeof record?.name === "string"
                    ? record.name
                    : typeof record?.id === "string"
                      ? record.id
                      : "",
                isDefault: record?.isDefault === true,
              }
            })
          : [],
        supportsResume: asRecord(agents?.["claude-code"])?.supportsResume === true,
        supportsStreaming:
          asRecord(agents?.["claude-code"])?.supportsStreaming === true,
      },
    },
  })
  if (!parsed.success) {
    throw new TaskApiClientError("Agent capabilities payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return parsed.data
}
