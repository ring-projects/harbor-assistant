export type SandboxProvider = "docker"

export type SandboxPurpose =
  | "task-run"
  | "task-prepare"
  | "preview"
  | "development"
  | "ad-hoc"

export type SandboxStatus =
  | "provisioning"
  | "ready"
  | "stopping"
  | "stopped"
  | "failed"

export type SandboxMode = "safe" | "connected" | "full-access"

export type SandboxSource =
  | {
      type: "empty"
    }
  | {
      type: "directory"
      path: string
    }
  | {
      type: "git"
      repositoryUrl: string
      ref: string | null
    }
  | {
      type: "tarball"
      tarballUrl: string
    }
  | {
      type: "snapshot"
      snapshotId: string
    }

export type SandboxComputeProfile = {
  vcpuCount: number
  memoryMb: number
  idleTimeoutSeconds: number
  maxDurationSeconds: number
}

export type SandboxNetworkPolicy =
  | {
      outboundMode: "deny-all"
      allowedHosts: string[]
    }
  | {
      outboundMode: "allow-all"
      allowedHosts: string[]
    }
  | {
      outboundMode: "allow-list"
      allowedHosts: string[]
    }

export type SandboxMetadata = {
  workspaceId: string | null
  projectId: string | null
  taskId: string | null
  purpose: SandboxPurpose
  labels: Record<string, string>
}

export type SandboxEnvironment = {
  id: string
  provider: SandboxProvider
  providerSandboxId: string
  mode: SandboxMode
  status: SandboxStatus
  source: SandboxSource
  workingDirectory: string
  profile: SandboxComputeProfile
  networkPolicy: SandboxNetworkPolicy
  metadata: SandboxMetadata
  previewBaseUrl: string | null
  failureReason: string | null
  createdAt: Date
  updatedAt: Date
  lastReadyAt: Date | null
  stoppedAt: Date | null
}

export function createSandboxEnvironment(input: {
  id: string
  provider: SandboxProvider
  providerSandboxId: string
  mode: SandboxMode
  source: SandboxSource
  workingDirectory: string
  profile: SandboxComputeProfile
  networkPolicy: SandboxNetworkPolicy
  metadata?: Partial<SandboxMetadata>
  previewBaseUrl?: string | null
  createdAt?: Date
}) {
  const createdAt = input.createdAt ?? new Date()

  return {
    id: input.id.trim(),
    provider: input.provider,
    providerSandboxId: input.providerSandboxId.trim(),
    mode: input.mode,
    status: "ready" as const,
    source: input.source,
    workingDirectory: input.workingDirectory.trim(),
    profile: input.profile,
    networkPolicy: input.networkPolicy,
    metadata: {
      workspaceId: input.metadata?.workspaceId?.trim() || null,
      projectId: input.metadata?.projectId?.trim() || null,
      taskId: input.metadata?.taskId?.trim() || null,
      purpose: input.metadata?.purpose ?? "ad-hoc",
      labels: { ...(input.metadata?.labels ?? {}) },
    },
    previewBaseUrl: input.previewBaseUrl?.trim() || null,
    failureReason: null,
    createdAt,
    updatedAt: createdAt,
    lastReadyAt: createdAt,
    stoppedAt: null,
  } satisfies SandboxEnvironment
}

export function markSandboxStopping(
  sandbox: SandboxEnvironment,
  now = new Date(),
): SandboxEnvironment {
  if (sandbox.status === "stopped" || sandbox.status === "failed") {
    return sandbox
  }

  return {
    ...sandbox,
    status: "stopping",
    updatedAt: now,
  }
}

export function markSandboxStopped(
  sandbox: SandboxEnvironment,
  now = new Date(),
): SandboxEnvironment {
  return {
    ...sandbox,
    status: "stopped",
    updatedAt: now,
    stoppedAt: now,
    failureReason: null,
  }
}

export function markSandboxFailed(
  sandbox: SandboxEnvironment,
  reason: string,
  now = new Date(),
): SandboxEnvironment {
  const normalizedReason = reason.trim() || "Sandbox operation failed."

  return {
    ...sandbox,
    status: "failed",
    updatedAt: now,
    stoppedAt: now,
    failureReason: normalizedReason,
  }
}
