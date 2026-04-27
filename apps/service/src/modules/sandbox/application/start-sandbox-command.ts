import {
  createSandboxCommandRecord,
  markSandboxCommandCompleted,
  markSandboxCommandFailed,
  markSandboxCommandRunning,
} from "../domain/sandbox-command"
import { createSandboxError } from "../errors"
import type { SandboxProvisioningPort } from "./sandbox-provider"
import type { SandboxRegistry } from "./sandbox-registry"

export async function startSandboxCommandUseCase(
  deps: {
    provider: SandboxProvisioningPort
    registry: SandboxRegistry
    idGenerator?: () => string
  },
  input: {
    sandboxId: string
    command: string
    cwd?: string | null
    env?: Record<string, string>
    detached?: boolean
  },
) {
  const sandbox = await deps.registry.findSandboxById(input.sandboxId)
  if (!sandbox) {
    throw createSandboxError().notFound()
  }

  try {
    const providerCommand = await deps.provider.runCommand({
      providerSandboxId: sandbox.providerSandboxId,
      command: input.command,
      cwd: input.cwd,
      env: input.env,
      detached: input.detached,
    })

    const command = markSandboxCommandRunning(
      createSandboxCommandRecord({
        id: deps.idGenerator?.() ?? crypto.randomUUID(),
        sandboxId: sandbox.id,
        providerCommandId: providerCommand.providerCommandId,
        command: providerCommand.command,
        cwd: providerCommand.cwd,
        detached: providerCommand.detached,
        createdAt: providerCommand.startedAt ?? new Date(),
      }),
      providerCommand.startedAt ?? new Date(),
    )

    await deps.registry.saveCommand(command)

    void deps.provider
      .getCommand({
        providerSandboxId: sandbox.providerSandboxId,
        providerCommandId: providerCommand.providerCommandId,
      })
      .then(async (handle) => {
        if (!handle) {
          return
        }

        try {
          const result = await handle.wait()
          const nextCommand =
            result.exitCode === 0
              ? markSandboxCommandCompleted(command, {
                  exitCode: result.exitCode,
                })
              : markSandboxCommandFailed(
                  command,
                  `Sandbox command exited with code ${result.exitCode ?? "unknown"}.`,
                  {
                    exitCode: result.exitCode,
                  },
                )
          await deps.registry.saveCommand(nextCommand)
        } catch (error) {
          await deps.registry.saveCommand(
            markSandboxCommandFailed(
              command,
              error instanceof Error
                ? error.message
                : "Sandbox command failed while waiting for completion.",
            ),
          )
        }
      })
      .catch(() => {})

    return command
  } catch (error) {
    throw createSandboxError().providerError(
      error instanceof Error
        ? error.message
        : "Failed to start sandbox command.",
    )
  }
}
