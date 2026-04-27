import {
  markSandboxFailed,
  markSandboxStopped,
  markSandboxStopping,
} from "../domain/sandbox"
import { createSandboxError } from "../errors"
import type { SandboxProvisioningPort } from "./sandbox-provider"
import type { SandboxRegistry } from "./sandbox-registry"

export async function terminateSandboxUseCase(
  deps: {
    provider: SandboxProvisioningPort
    registry: SandboxRegistry
  },
  input: {
    sandboxId: string
  },
) {
  const sandbox = await deps.registry.findSandboxById(input.sandboxId)
  if (!sandbox) {
    throw createSandboxError().notFound()
  }

  const stopping = markSandboxStopping(sandbox)
  await deps.registry.saveSandbox(stopping)

  try {
    await deps.provider.destroySandbox(sandbox.providerSandboxId)
    const stopped = markSandboxStopped(stopping)
    await deps.registry.saveSandbox(stopped)
    return stopped
  } catch (error) {
    const failed = markSandboxFailed(
      stopping,
      error instanceof Error ? error.message : "Failed to terminate sandbox.",
    )
    await deps.registry.saveSandbox(failed)
    throw createSandboxError().providerError(failed.failureReason ?? undefined)
  }
}
