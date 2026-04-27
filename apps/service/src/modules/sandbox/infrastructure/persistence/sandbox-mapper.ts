import type {
  Sandbox as PrismaSandbox,
  SandboxCommand as PrismaSandboxCommand,
  SandboxSnapshot as PrismaSandboxSnapshot,
} from "@prisma/client"

import type {
  SandboxComputeProfile,
  SandboxEnvironment,
  SandboxMetadata,
  SandboxNetworkPolicy,
  SandboxSource,
} from "../../domain/sandbox"
import type { SandboxCommandRecord } from "../../domain/sandbox-command"
import type { SandboxSnapshotRecord } from "../../domain/sandbox-snapshot"

function asRecordOfStrings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => {
      return typeof entry[0] === "string" && typeof entry[1] === "string"
    }),
  )
}

function toSandboxSource(value: unknown): SandboxSource {
  return value as SandboxSource
}

function toSandboxProfile(value: unknown): SandboxComputeProfile {
  return value as SandboxComputeProfile
}

function toSandboxNetworkPolicy(value: unknown): SandboxNetworkPolicy {
  return value as SandboxNetworkPolicy
}

function toSandboxMetadata(record: PrismaSandbox): SandboxMetadata {
  return {
    workspaceId: record.workspaceId,
    projectId: record.projectId,
    taskId: record.taskId,
    purpose: record.purpose as SandboxMetadata["purpose"],
    labels: asRecordOfStrings(record.labels),
  }
}

export function toDomainSandbox(record: PrismaSandbox): SandboxEnvironment {
  return {
    id: record.id,
    provider: record.provider as SandboxEnvironment["provider"],
    providerSandboxId: record.providerSandboxId,
    mode: record.mode as SandboxEnvironment["mode"],
    status: record.status as SandboxEnvironment["status"],
    source: toSandboxSource(record.source),
    workingDirectory: record.workingDirectory,
    profile: toSandboxProfile(record.profile),
    networkPolicy: toSandboxNetworkPolicy(record.networkPolicy),
    metadata: toSandboxMetadata(record),
    previewBaseUrl: record.previewBaseUrl,
    failureReason: record.failureReason,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastReadyAt: record.lastReadyAt,
    stoppedAt: record.stoppedAt,
  }
}

export function toDomainSandboxCommand(
  record: PrismaSandboxCommand,
): SandboxCommandRecord {
  return {
    id: record.id,
    sandboxId: record.sandboxId,
    providerCommandId: record.providerCommandId,
    command: record.command,
    cwd: record.cwd,
    detached: record.detached,
    status: record.status as SandboxCommandRecord["status"],
    exitCode: record.exitCode,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  }
}

export function toDomainSandboxSnapshot(
  record: PrismaSandboxSnapshot,
): SandboxSnapshotRecord {
  return {
    id: record.id,
    sandboxId: record.sandboxId,
    providerSnapshotId: record.providerSnapshotId,
    providerSnapshotRef: record.providerSnapshotRef,
    createdAt: record.createdAt,
  }
}
