export type SandboxCommandStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export type SandboxCommandRecord = {
  id: string
  sandboxId: string
  providerCommandId: string
  command: string
  cwd: string | null
  detached: boolean
  status: SandboxCommandStatus
  exitCode: number | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  finishedAt: Date | null
}

export function createSandboxCommandRecord(input: {
  id: string
  sandboxId: string
  providerCommandId: string
  command: string
  cwd?: string | null
  detached?: boolean
  createdAt?: Date
}) {
  const createdAt = input.createdAt ?? new Date()

  return {
    id: input.id.trim(),
    sandboxId: input.sandboxId.trim(),
    providerCommandId: input.providerCommandId.trim(),
    command: input.command.trim(),
    cwd: input.cwd?.trim() || null,
    detached: input.detached ?? false,
    status: "queued" as const,
    exitCode: null,
    errorMessage: null,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    finishedAt: null,
  } satisfies SandboxCommandRecord
}

export function markSandboxCommandRunning(
  command: SandboxCommandRecord,
  now = new Date(),
): SandboxCommandRecord {
  return {
    ...command,
    status: "running",
    updatedAt: now,
    startedAt: command.startedAt ?? now,
  }
}

export function markSandboxCommandCompleted(
  command: SandboxCommandRecord,
  input: {
    exitCode?: number | null
    finishedAt?: Date
  } = {},
): SandboxCommandRecord {
  const finishedAt = input.finishedAt ?? new Date()

  return {
    ...command,
    status: "completed",
    updatedAt: finishedAt,
    finishedAt,
    exitCode: input.exitCode ?? 0,
    errorMessage: null,
  }
}

export function markSandboxCommandFailed(
  command: SandboxCommandRecord,
  reason: string,
  input: {
    exitCode?: number | null
    finishedAt?: Date
  } = {},
): SandboxCommandRecord {
  const finishedAt = input.finishedAt ?? new Date()

  return {
    ...command,
    status: "failed",
    updatedAt: finishedAt,
    finishedAt,
    exitCode: input.exitCode ?? null,
    errorMessage: reason.trim() || "Sandbox command failed.",
  }
}

export function markSandboxCommandCancelled(
  command: SandboxCommandRecord,
  finishedAt = new Date(),
): SandboxCommandRecord {
  return {
    ...command,
    status: "cancelled",
    updatedAt: finishedAt,
    finishedAt,
    exitCode: null,
    errorMessage: null,
  }
}
