export type SandboxSnapshotRecord = {
  id: string
  sandboxId: string
  providerSnapshotId: string
  providerSnapshotRef: string | null
  createdAt: Date
}

export function createSandboxSnapshotRecord(input: {
  id: string
  sandboxId: string
  providerSnapshotId: string
  providerSnapshotRef?: string | null
  createdAt?: Date
}) {
  return {
    id: input.id.trim(),
    sandboxId: input.sandboxId.trim(),
    providerSnapshotId: input.providerSnapshotId.trim(),
    providerSnapshotRef: input.providerSnapshotRef?.trim() || null,
    createdAt: input.createdAt ?? new Date(),
  } satisfies SandboxSnapshotRecord
}
