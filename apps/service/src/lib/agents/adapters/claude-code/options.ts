import type {
  ClaudePermissionMode,
  ClaudeQueryOptions,
} from "./sdk.js"

import type {
  AgentRuntimeOptions,
  RuntimeReasoningEffort,
} from "../../types"
import { buildChildProcessEnv } from "../../../process-env"

function mapApprovalPolicyToPermissionMode(
  approvalPolicy: AgentRuntimeOptions["approvalPolicy"],
): ClaudePermissionMode {
  switch (approvalPolicy) {
    case "never":
      return "bypassPermissions"
    case "on-request":
      return "default"
    case "untrusted":
      return "plan"
    default:
      return "bypassPermissions"
  }
}

function mapEffort(
  effort: RuntimeReasoningEffort | undefined,
): ClaudeQueryOptions["effort"] {
  switch (effort) {
    case "minimal":
      return "low"
    case "low":
      return "low"
    case "medium":
      return "medium"
    case "high":
      return "high"
    case "xhigh":
      return "max"
    default:
      return undefined
  }
}

function buildDisallowedTools(options: AgentRuntimeOptions): string[] {
  return options.networkAccessEnabled === false
    ? ["WebFetch", "WebSearch", "AskUserQuestion"]
    : ["AskUserQuestion"]
}

function buildSandbox(options: AgentRuntimeOptions): ClaudeQueryOptions["sandbox"] {
  const allowedPaths = [
    options.workingDirectory,
    ...(options.additionalDirectories ?? []),
  ]

  switch (options.sandboxMode) {
    case "danger-full-access":
      return {
        enabled: false,
      }

    case "read-only":
      return {
        enabled: true,
        allowUnsandboxedCommands: false,
        filesystem: {
          allowRead: allowedPaths,
          allowWrite: [],
          allowManagedReadPathsOnly: false,
        },
      }

    case "workspace-write":
    default:
      return {
        enabled: true,
        allowUnsandboxedCommands: false,
        autoAllowBashIfSandboxed: options.approvalPolicy === "never",
        filesystem: {
          allowRead: allowedPaths,
          allowWrite: allowedPaths,
          allowManagedReadPathsOnly: false,
        },
      }
  }
}

export function buildClaudeProcessEnv(overrides?: Record<string, string>) {
  const env = buildChildProcessEnv(overrides)
  env.NO_COLOR = "1"
  return env
}

export function buildClaudeQueryOptions(args: {
  options: AgentRuntimeOptions
  abortController: AbortController
  resumeSessionId?: string
}): ClaudeQueryOptions {
  const permissionMode = mapApprovalPolicyToPermissionMode(
    args.options.approvalPolicy,
  )

  return {
    abortController: args.abortController,
    cwd: args.options.workingDirectory,
    additionalDirectories: args.options.additionalDirectories,
    env: buildClaudeProcessEnv(args.options.env),
    model: args.options.modelId,
    effort: mapEffort(args.options.effort),
    permissionMode,
    allowDangerouslySkipPermissions: permissionMode === "bypassPermissions",
    disallowedTools: buildDisallowedTools(args.options),
    sandbox: buildSandbox(args.options),
    resume: args.resumeSessionId,
  }
}
