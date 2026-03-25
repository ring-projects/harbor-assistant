import type { AgentModel, AgentType } from "./types"

// Harbor-maintained model choices for providers that do not expose a stable
// machine-readable catalog API. This is a curated candidate set, not a
// provider-authoritative real-time model inventory.
const CODEX_MODELS: AgentModel[] = [
  {
    id: "gpt-5.3-codex",
    name: "GPT-5.3 Codex",
    isDefault: true,
    efforts: ["low", "medium", "high", "xhigh"],
  },
  {
    id: "gpt-5.4",
    name: "GPT-5.4",
    isDefault: false,
    efforts: ["low", "medium", "high", "xhigh"],
  },
  {
    id: "gpt-5.2-codex",
    name: "GPT-5.2 Codex",
    isDefault: false,
    efforts: ["low", "medium", "high", "xhigh"],
  },
  {
    id: "gpt-5.1-codex-max",
    name: "GPT-5.1 Codex Max",
    isDefault: false,
    efforts: ["low", "medium", "high", "xhigh"],
  },
  {
    id: "gpt-5.2",
    name: "GPT-5.2",
    isDefault: false,
    efforts: ["low", "medium", "high", "xhigh"],
  },
  {
    id: "gpt-5.1-codex-mini",
    name: "GPT-5.1 Codex Mini",
    isDefault: false,
    efforts: ["medium", "high"],
  },
]

const CLAUDE_CODE_MODELS: AgentModel[] = [
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    isDefault: true,
    efforts: ["low", "medium", "high", "xhigh"],
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    isDefault: false,
    efforts: ["low", "medium", "high", "xhigh"],
  },
]

export const AGENT_MODEL_CONFIG: Record<AgentType, AgentModel[]> = {
  codex: CODEX_MODELS,
  "claude-code": CLAUDE_CODE_MODELS,
}

export function getConfiguredAgentModels(type: AgentType): AgentModel[] {
  return AGENT_MODEL_CONFIG[type].map((model) => ({
    ...model,
    efforts: [...model.efforts],
  }))
}
