import type { AgentRuntimeOptions } from "../../../../lib/agents"
import type { TaskEffort } from "../../domain/task-effort"

export type TaskRuntimeExecutionMode = "safe" | "connected" | "full-access"

type TaskRuntimePolicy = Pick<
  AgentRuntimeOptions,
  | "sandboxMode"
  | "approvalPolicy"
  | "networkAccessEnabled"
  | "webSearchMode"
  | "additionalDirectories"
>

const RUNTIME_POLICY_PRESETS: Record<
  TaskRuntimeExecutionMode,
  TaskRuntimePolicy
> = {
  safe: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchMode: "cached",
    additionalDirectories: [],
  },
  connected: {
    sandboxMode: "workspace-write",
    approvalPolicy: "never",
    networkAccessEnabled: true,
    webSearchMode: "live",
    additionalDirectories: [],
  },
  "full-access": {
    sandboxMode: "danger-full-access",
    approvalPolicy: "never",
    networkAccessEnabled: true,
    webSearchMode: "live",
    additionalDirectories: [],
  },
}

export function normalizeTaskExecutionMode(
  executionMode: string | null | undefined,
): TaskRuntimeExecutionMode {
  const normalized = executionMode?.trim().toLowerCase()
  if (
    normalized === "safe" ||
    normalized === "connected" ||
    normalized === "full-access"
  ) {
    return normalized
  }

  return "safe"
}

export function createAgentRuntimeOptions(args: {
  workingDirectory: string
  modelId?: string | null
  executionMode?: string | null
  effort?: TaskEffort | null
  env?: Record<string, string>
}): AgentRuntimeOptions {
  const policy = RUNTIME_POLICY_PRESETS[
    normalizeTaskExecutionMode(args.executionMode)
  ]

  return {
    workingDirectory: args.workingDirectory,
    modelId: args.modelId ?? undefined,
    effort: args.effort ?? undefined,
    env: args.env,
    sandboxMode: policy.sandboxMode,
    approvalPolicy: policy.approvalPolicy,
    networkAccessEnabled: policy.networkAccessEnabled,
    webSearchMode: policy.webSearchMode,
    additionalDirectories: [...(policy.additionalDirectories ?? [])],
  }
}
