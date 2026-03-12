import type { SessionOptions } from "../../lib/agents"

export type RuntimeExecutionMode =
  | "safe"
  | "connected"
  | "full-access"
  | "custom"

export type RuntimeSandboxMode =
  | "read-only"
  | "workspace-write"
  | "danger-full-access"

export type RuntimeApprovalPolicy = "never" | "on-request" | "untrusted"

export type RuntimeWebSearchMode = "disabled" | "cached" | "live"

export type RuntimePolicy = {
  sandboxMode: RuntimeSandboxMode
  approvalPolicy: RuntimeApprovalPolicy
  networkAccessEnabled: boolean
  webSearchMode: RuntimeWebSearchMode
  additionalDirectories: string[]
}

export type RuntimePolicyInput = Partial<
  Omit<RuntimePolicy, "additionalDirectories">
> & {
  additionalDirectories?: string[] | null
}

export const RUNTIME_POLICY_PRESETS: Record<
  Exclude<RuntimeExecutionMode, "custom">,
  RuntimePolicy
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

function uniqueNonEmptyDirectories(directories: string[] | null | undefined) {
  const seen = new Set<string>()
  const items: string[] = []

  for (const entry of directories ?? []) {
    if (typeof entry !== "string") {
      continue
    }

    const normalized = entry.trim()
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    items.push(normalized)
  }

  return items
}

function clonePolicy(policy: RuntimePolicy): RuntimePolicy {
  return {
    sandboxMode: policy.sandboxMode,
    approvalPolicy: policy.approvalPolicy,
    networkAccessEnabled: policy.networkAccessEnabled,
    webSearchMode: policy.webSearchMode,
    additionalDirectories: [...policy.additionalDirectories],
  }
}

function normalizeExecutionMode(
  executionMode: string | null | undefined,
): RuntimeExecutionMode | null {
  const normalized = executionMode?.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (
    normalized === "safe" ||
    normalized === "connected" ||
    normalized === "full-access" ||
    normalized === "custom"
  ) {
    return normalized
  }

  return null
}

export function normalizeRuntimePolicy(
  input: RuntimePolicyInput | null | undefined,
): RuntimePolicyInput | null {
  if (!input) {
    return null
  }

  const next: RuntimePolicyInput = {}

  if (
    input.sandboxMode === "read-only" ||
    input.sandboxMode === "workspace-write" ||
    input.sandboxMode === "danger-full-access"
  ) {
    next.sandboxMode = input.sandboxMode
  }

  if (
    input.approvalPolicy === "never" ||
    input.approvalPolicy === "on-request" ||
    input.approvalPolicy === "untrusted"
  ) {
    next.approvalPolicy = input.approvalPolicy
  }

  if (typeof input.networkAccessEnabled === "boolean") {
    next.networkAccessEnabled = input.networkAccessEnabled
  }

  if (
    input.webSearchMode === "disabled" ||
    input.webSearchMode === "cached" ||
    input.webSearchMode === "live"
  ) {
    next.webSearchMode = input.webSearchMode
  }

  next.additionalDirectories = uniqueNonEmptyDirectories(
    input.additionalDirectories,
  )

  return next
}

export function policiesEqual(left: RuntimePolicy, right: RuntimePolicy) {
  return (
    left.sandboxMode === right.sandboxMode &&
    left.approvalPolicy === right.approvalPolicy &&
    left.networkAccessEnabled === right.networkAccessEnabled &&
    left.webSearchMode === right.webSearchMode &&
    left.additionalDirectories.length === right.additionalDirectories.length &&
    left.additionalDirectories.every((item, index) => item === right.additionalDirectories[index])
  )
}

export function inferExecutionMode(policy: RuntimePolicy): RuntimeExecutionMode {
  for (const [mode, preset] of Object.entries(RUNTIME_POLICY_PRESETS)) {
    if (policiesEqual(policy, preset)) {
      return mode as RuntimeExecutionMode
    }
  }

  return "custom"
}

export function resolveRuntimePolicy(input?: {
  executionMode?: string | null
  runtimePolicy?: RuntimePolicyInput | null
}): {
  executionMode: RuntimeExecutionMode
  runtimePolicy: RuntimePolicy
} {
  const mode = normalizeExecutionMode(input?.executionMode)
  const normalizedPolicy = normalizeRuntimePolicy(input?.runtimePolicy)
  const basePolicy = clonePolicy(
    mode && mode !== "custom" ? RUNTIME_POLICY_PRESETS[mode] : RUNTIME_POLICY_PRESETS.safe,
  )

  const resolvedPolicy: RuntimePolicy = {
    sandboxMode: normalizedPolicy?.sandboxMode ?? basePolicy.sandboxMode,
    approvalPolicy: normalizedPolicy?.approvalPolicy ?? basePolicy.approvalPolicy,
    networkAccessEnabled:
      normalizedPolicy?.networkAccessEnabled ?? basePolicy.networkAccessEnabled,
    webSearchMode: normalizedPolicy?.webSearchMode ?? basePolicy.webSearchMode,
    additionalDirectories:
      normalizedPolicy?.additionalDirectories ?? basePolicy.additionalDirectories,
  }

  const resolvedMode =
    mode === "custom" || normalizedPolicy
      ? inferExecutionMode(resolvedPolicy)
      : (mode ?? "safe")

  return {
    executionMode: resolvedMode,
    runtimePolicy: resolvedPolicy,
  }
}

export function runtimePolicyToSessionOptions(
  policy: RuntimePolicy,
): Pick<
  SessionOptions,
  | "sandboxMode"
  | "approvalPolicy"
  | "networkAccessEnabled"
  | "webSearchMode"
  | "additionalDirectories"
> {
  return {
    sandboxMode: policy.sandboxMode,
    approvalPolicy: policy.approvalPolicy,
    networkAccessEnabled: policy.networkAccessEnabled,
    webSearchMode: policy.webSearchMode,
    additionalDirectories: [...policy.additionalDirectories],
  }
}

export function parseRuntimePolicy(
  value: string | null | undefined,
): RuntimePolicy | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as RuntimePolicyInput
    const normalized = normalizeRuntimePolicy(parsed)
    if (!normalized) {
      return null
    }

    return resolveRuntimePolicy({
      runtimePolicy: normalized,
      executionMode: "custom",
    }).runtimePolicy
  } catch {
    return null
  }
}

export function serializeRuntimePolicy(policy: RuntimePolicy | null | undefined) {
  if (!policy) {
    return null
  }

  return JSON.stringify(policy)
}
