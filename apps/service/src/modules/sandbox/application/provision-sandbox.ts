import { createSandboxEnvironment } from "../domain/sandbox"
import type { SandboxPurpose } from "../domain/sandbox"
import { createSandboxError } from "../errors"
import {
  resolveSandboxNetworkPolicy,
  resolveSandboxProfile,
} from "./sandbox-profile"
import type { SandboxProvisioningPort } from "./sandbox-provider"
import type { SandboxRegistry } from "./sandbox-registry"

export async function provisionSandboxUseCase(
  deps: {
    provider: SandboxProvisioningPort
    registry: SandboxRegistry
    idGenerator?: () => string
  },
  input: {
    mode: "safe" | "connected" | "full-access"
    source: Parameters<SandboxProvisioningPort["createSandbox"]>[0]["source"]
    workingDirectory?: string | null
    workspaceId?: string | null
    projectId?: string | null
    taskId?: string | null
    purpose?: SandboxPurpose
    labels?: Record<string, string>
  },
) {
  const id = deps.idGenerator?.() ?? crypto.randomUUID()
  const profile = resolveSandboxProfile(input.mode)
  const networkPolicy = resolveSandboxNetworkPolicy(input.mode)

  try {
    const provisioned = await deps.provider.createSandbox({
      source: input.source,
      workingDirectory: input.workingDirectory,
      profile,
      networkPolicy,
      metadata: {
        workspaceId: input.workspaceId?.trim() || null,
        projectId: input.projectId?.trim() || null,
        taskId: input.taskId?.trim() || null,
        purpose: input.purpose ?? "ad-hoc",
        labels: { ...(input.labels ?? {}) },
      },
    })

    const sandbox = createSandboxEnvironment({
      id,
      provider: deps.provider.provider,
      providerSandboxId: provisioned.providerSandboxId,
      mode: input.mode,
      source: input.source,
      workingDirectory: provisioned.workingDirectory,
      profile,
      networkPolicy,
      metadata: {
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        taskId: input.taskId,
        purpose: input.purpose,
        labels: input.labels,
      },
      previewBaseUrl: provisioned.previewBaseUrl ?? null,
    })

    await deps.registry.saveSandbox(sandbox)
    return sandbox
  } catch (error) {
    throw createSandboxError().providerError(
      error instanceof Error ? error.message : "Failed to provision sandbox.",
    )
  }
}
