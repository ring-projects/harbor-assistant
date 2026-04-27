import type { PrismaClient } from "@prisma/client"
import type { SandboxProvisioningPort } from "../application/sandbox-provider"
import type { SandboxRegistry } from "../application/sandbox-registry"
import { InMemorySandboxRegistry } from "../infrastructure/in-memory-sandbox-registry"
import { DockerSandboxProvider } from "../infrastructure/docker-sandbox-provider"
import { PrismaSandboxRegistry } from "../infrastructure/persistence/prisma-sandbox-registry"

export function createConfiguredSandboxServices(args: {
  prisma?: PrismaClient
  sandboxRootDirectory?: string
  logger?: {
    info?: (message: string) => void
    warn?: (message: string) => void
  }
}): {
  provider?: SandboxProvisioningPort
  registry?: SandboxRegistry
} {
  const provider = args.sandboxRootDirectory
    ? new DockerSandboxProvider(
        args.sandboxRootDirectory,
        undefined,
        args.logger,
      )
    : undefined

  if (provider?.provider === "docker") {
    args.logger?.info?.(
      `Docker Sandboxes sbx provider ready at ${args.sandboxRootDirectory}`,
    )
  }

  return {
    provider,
    registry: provider
      ? args.prisma
        ? new PrismaSandboxRegistry(args.prisma)
        : new InMemorySandboxRegistry()
      : undefined,
  }
}
