import type { ThreadOptions as CodexThreadOptions } from "@openai/codex-sdk"

import type { AgentRuntimeOptions } from "../../types"
import { buildChildProcessEnv } from "../../../process-env"

export function buildCodexProcessEnv(overrides?: Record<string, string>) {
  const env = buildChildProcessEnv(overrides)
  env.NO_COLOR = "1"
  return env
}

export function buildCodexThreadOptions(
  options: AgentRuntimeOptions,
): CodexThreadOptions {
  return {
    workingDirectory: options.workingDirectory,
    model: options.modelId ?? undefined,
    modelReasoningEffort: options.effort ?? undefined,
    sandboxMode: options.sandboxMode ?? "workspace-write",
    approvalPolicy: options.approvalPolicy ?? "never",
    networkAccessEnabled: options.networkAccessEnabled ?? false,
    webSearchMode: options.webSearchMode ?? undefined,
    additionalDirectories: options.additionalDirectories ?? undefined,
    // Harbor task runs may start outside a Git repo, so this check stays disabled.
    skipGitRepoCheck: true,
  }
}
