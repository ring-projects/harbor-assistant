import { createSandboxSnapshotRecord } from "../domain/sandbox-snapshot"
import { createSandboxError } from "../errors"
import type { SandboxProvisioningPort } from "./sandbox-provider"
import type { SandboxRegistry } from "./sandbox-registry"

export async function captureSandboxSnapshotUseCase(
  deps: {
    provider: SandboxProvisioningPort
    registry: SandboxRegistry
    idGenerator?: () => string
  },
  input: {
    sandboxId: string
  },
) {
  const sandbox = await deps.registry.findSandboxById(input.sandboxId)
  if (!sandbox) {
    throw createSandboxError().notFound()
  }

  try {
    const snapshot = await deps.provider.createSnapshot(
      sandbox.providerSandboxId,
    )
    const record = createSandboxSnapshotRecord({
      id: deps.idGenerator?.() ?? crypto.randomUUID(),
      sandboxId: sandbox.id,
      providerSnapshotId: snapshot.providerSnapshotId,
      providerSnapshotRef: snapshot.providerSnapshotRef,
    })
    await deps.registry.saveSnapshot(record)
    return record
  } catch (error) {
    throw createSandboxError().providerError(
      error instanceof Error
        ? error.message
        : "Failed to capture sandbox snapshot.",
    )
  }
}
