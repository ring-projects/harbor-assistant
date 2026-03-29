import {
  asRecord,
  toIsoDateString,
  toStringOrEmpty,
  toStringOrNull,
} from "@/lib/protocol"
import {
  agentCapabilityResultSchema,
  type AgentCapabilityResult,
} from "@/modules/tasks/contracts"

function extractAgentModels(candidate: unknown): unknown[] {
  const source = asRecord(candidate)
  return Array.isArray(source?.models) ? source.models : []
}

function extractAgentModel(candidate: unknown) {
  const source = asRecord(candidate)

  return {
    id: toStringOrEmpty(source?.id),
    displayName: toStringOrNull(source?.name) ?? toStringOrEmpty(source?.id),
    isDefault: source?.isDefault === true,
    efforts: Array.isArray(source?.efforts)
      ? source.efforts.filter((effort): effort is string => typeof effort === "string")
      : [],
  }
}

export function extractAgentCapabilities(
  payload: unknown,
): AgentCapabilityResult | null {
  const capabilities = asRecord(payload)
  const agents = asRecord(capabilities?.agents)
  const codex = asRecord(agents?.codex)
  const claudeCode = asRecord(agents?.["claude-code"])

  const parsed = agentCapabilityResultSchema.safeParse({
    checkedAt: toIsoDateString(capabilities?.checkedAt),
    agents: {
      codex: {
        models: extractAgentModels(codex).map(extractAgentModel),
        supportsResume: codex?.supportsResume === true,
        supportsStreaming: codex?.supportsStreaming === true,
      },
      "claude-code": {
        models: extractAgentModels(claudeCode).map(extractAgentModel),
        supportsResume: claudeCode?.supportsResume === true,
        supportsStreaming: claudeCode?.supportsStreaming === true,
      },
    },
  })

  return parsed.success ? parsed.data : null
}
