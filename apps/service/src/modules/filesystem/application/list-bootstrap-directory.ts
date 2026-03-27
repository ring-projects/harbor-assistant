import { createBootstrapRootRegistry, type BootstrapFileSystemRootConfig } from "./bootstrap-root-registry"
import type { FileSystemRepository } from "./filesystem-repository"
import { listDirectoryUseCase } from "./list-directory"
import { toBootstrapRelativePath } from "./bootstrap-shared"
import type { BootstrapDirectoryListing } from "../types"

export async function listBootstrapDirectoryUseCase(
  repository: FileSystemRepository,
  roots: BootstrapFileSystemRootConfig[],
  input: {
    rootId: string
    path?: string
    cursor?: string | null
    limit?: number
    includeHidden?: boolean
    directoriesOnly?: boolean
  },
): Promise<BootstrapDirectoryListing> {
  const registry = createBootstrapRootRegistry(repository, roots)
  const root = await registry.getRoot(input.rootId)
  const listing = await listDirectoryUseCase(repository, {
    rootPath: root.path,
    path: input.path,
    cursor: input.cursor,
    limit: input.limit,
    includeHidden: input.includeHidden,
  })

  const entries = listing.entries
    .filter((entry) => !input.directoriesOnly || entry.type === "directory")
    .map((entry) => ({
      ...entry,
      path: toBootstrapRelativePath(root.path, entry.path) ?? "",
      absolutePath: entry.path,
    }))

  return {
    rootId: root.id,
    rootPath: root.path,
    path: toBootstrapRelativePath(root.path, listing.path),
    absolutePath: listing.path,
    parentPath: listing.parentPath
      ? toBootstrapRelativePath(root.path, listing.parentPath)
      : null,
    entries,
    nextCursor: listing.nextCursor,
    truncated: listing.truncated,
  }
}
