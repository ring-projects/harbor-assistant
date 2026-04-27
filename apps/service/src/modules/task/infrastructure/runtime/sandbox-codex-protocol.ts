import type {
  AgentInput,
  AgentRuntimeOptions,
  RawAgentEventEnvelope,
} from "../../../../lib/agents"

export type SandboxCodexRunnerPayload = {
  sessionId: string | null
  options: AgentRuntimeOptions
  input: AgentInput
}

export type SandboxCodexRunnerEnvelope =
  | {
      kind: "event"
      createdAt: string
      event: RawAgentEventEnvelope["event"]
    }
  | {
      kind: "error"
      message: string
    }
