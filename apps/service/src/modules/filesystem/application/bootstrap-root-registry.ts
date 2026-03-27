import type { FileSystemRepository } from "./filesystem-repository"
import { resolveRootPath } from "./shared"
import { createFileSystemError } from "../errors"
import type { BootstrapFileSystemRoot } from "../types"

export type BootstrapFileSystemRootConfig = {
  id: string
  label: string
  path: string
  isDefault?: boolean
}

type BootstrapRootRegistry = {
  listRoots(): Promise<BootstrapFileSystemRoot[]>
  getRoot(rootId: string): Promise<BootstrapFileSystemRoot>
}

function validateRootDefinitions(roots: BootstrapFileSystemRootConfig[]) {
  if (roots.length === 0) {
    throw createFileSystemError().bootstrapFilesystemDisabled()
  }

  const ids = new Set<string>()
  let defaultRootCount = 0

  for (const root of roots) {
    const normalizedId = root.id.trim()
    if (!normalizedId) {
      throw createFileSystemError().invalidInput(
        "Bootstrap filesystem root id is required.",
      )
    }

    if (ids.has(normalizedId)) {
      throw createFileSystemError().invalidInput(
        `Duplicate bootstrap filesystem root id: ${normalizedId}`,
      )
    }

    ids.add(normalizedId)

    if (root.isDefault) {
      defaultRootCount += 1
    }
  }

  if (defaultRootCount > 1) {
    throw createFileSystemError().invalidInput(
      "Only one bootstrap filesystem root can be default.",
    )
  }
}

export function createBootstrapRootRegistry(
  repository: FileSystemRepository,
  rootConfigs: BootstrapFileSystemRootConfig[],
): BootstrapRootRegistry {
  let rootsPromise: Promise<BootstrapFileSystemRoot[]> | null = null

  async function resolveRoots() {
    validateRootDefinitions(rootConfigs)

    const roots = await Promise.all(
      rootConfigs.map(async (root, index) => ({
        id: root.id.trim(),
        label: root.label.trim() || root.id.trim(),
        path: await resolveRootPath(repository, root.path),
        isDefault:
          root.isDefault === true ||
          (rootConfigs.length === 1 && index === 0) ||
          false,
      })),
    )

    if (!roots.some((root) => root.isDefault) && roots.length > 0) {
      return roots.map((root, index) =>
        index === 0 ? { ...root, isDefault: true } : root,
      )
    }

    return roots
  }

  async function listRoots() {
    rootsPromise ??= resolveRoots()
    return rootsPromise
  }

  return {
    listRoots,
    async getRoot(rootId) {
      const roots = await listRoots()
      const normalizedRootId = rootId.trim()
      const root = roots.find((item) => item.id === normalizedRootId)

      if (!root) {
        throw createFileSystemError().rootNotFound(normalizedRootId)
      }

      return root
    },
  }
}
