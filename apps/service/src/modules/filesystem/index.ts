export type {
  FileSystemEntryType,
  FileSystemListEntry,
  FileSystemListResult,
} from "./types"

export { FileSystemError, createFileSystemError } from "./errors"
export type { FileSystemErrorCode } from "./errors"

export { createFileSystemRepository } from "./repositories"
export type { FileSystemRepository } from "./repositories"

export { createFileSystemService } from "./services"
export type { FileSystemService, ListDirectoryInput } from "./services"

export { registerFileSystemModuleRoutes } from "./routes"

import { createFileSystemRepository } from "./repositories"
import { createFileSystemService } from "./services"

export function createFileSystemModule(args: { rootDirectory: string }) {
  const fileSystemRepository = createFileSystemRepository()
  const fileSystemService = createFileSystemService({
    fileSystemRepository,
    rootDirectory: args.rootDirectory,
  })

  return {
    repositories: {
      fileSystemRepository,
    },
    services: {
      fileSystemService,
    },
  }
}
