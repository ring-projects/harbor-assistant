/**
 * Agent type identifier
 */
export type AgentType = "codex" | "claude-code"

export type AgentInputItem =
  | {
      type: "text"
      text: string
    }
  | {
      type: "local_image"
      path: string
    }
  | {
      type: "local_file"
      path: string
    }

export type AgentInput = string | AgentInputItem[]

/**
 * Runtime configuration passed to an external agent provider.
 */
export type AgentRuntimeOptions = {
  workingDirectory: string
  modelId?: string
  effort?: RuntimeReasoningEffort
  env?: Record<string, string>
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access"
  approvalPolicy?: "never" | "on-request" | "untrusted"
  networkAccessEnabled?: boolean
  webSearchMode?: "disabled" | "cached" | "live"
  additionalDirectories?: string[]
}

/**
 * Raw agent runtime event envelope.
 * This is the provider-facing event shape emitted by adapters.
 */
export type RawAgentEventEnvelope = {
  agentType: AgentType
  event: unknown
  createdAt: Date
}

/**
 * Agent model information
 */
export type ReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"

export type RuntimeReasoningEffort = Exclude<ReasoningEffort, "none">

export type AgentModel = {
  id: string
  name: string
  isDefault: boolean
  efforts: ReasoningEffort[]
}

/**
 * Agent capabilities information
 */
export type AgentCapabilities = {
  models: AgentModel[]
  supportsResume: boolean
  supportsStreaming: boolean
}

/**
 * Agent capability detection result
 */
export type AgentCapabilityResult = {
  checkedAt: Date
  agents: Record<AgentType, AgentCapabilities>
}

/**
 * Runtime execution interface for an external agent provider.
 */
export interface IAgentRuntime {
  readonly type: AgentType

  startSessionAndRun(
    options: AgentRuntimeOptions,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope>

  resumeSessionAndRun(
    sessionId: string,
    options: AgentRuntimeOptions,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope>
}

/**
 * Capability inspection interface for an external agent provider.
 */
export interface IAgentCapabilityProvider {
  readonly type: AgentType

  inspect(): Promise<AgentCapabilities>
}

/**
 * One registered agent provider definition.
 */
export type AgentRegistration = {
  type: AgentType
  runtime: IAgentRuntime
  capability: IAgentCapabilityProvider
}

/**
 * Registry contract for resolving agent runtimes and capabilities.
 */
export interface IAgentRegistry {
  has(type: AgentType): boolean
  get(type: AgentType): AgentRegistration
  getRuntime(type: AgentType): IAgentRuntime
  getCapability(type: AgentType): IAgentCapabilityProvider
  list(): AgentRegistration[]
  listTypes(): AgentType[]
  inspectAll(): Promise<AgentCapabilityResult>
}
