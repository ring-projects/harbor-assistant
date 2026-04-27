import {
  createBootstrapRootRegistry,
  type BootstrapFileSystemRootConfig,
} from "./bootstrap-root-registry"
import type { FileSystemRepository } from "./filesystem-repository"
import { statPathUseCase } from "./stat-path"
import { toBootstrapRelativePath } from "./bootstrap-shared"
import type { BootstrapFileSystemPathInfo } from "../types"

export async function statBootstrapPathUseCase(
  repository: FileSystemRepository,
  roots: BootstrapFileSystemRootConfig[],
  input: {
    rootId: string
    path?: string
  },
): Promise<BootstrapFileSystemPathInfo> {
  const registry = createBootstrapRootRegistry(repository, roots)
  const root = await registry.getRoot(input.rootId)
  const pathInfo = await statPathUseCase(repository, {
    rootPath: root.path,
    path: input.path,
  })

  return {
    rootId: root.id,
    rootPath: root.path,
    path: toBootstrapRelativePath(root.path, pathInfo.path),
    absolutePath: pathInfo.path,
    type: pathInfo.type,
    isHidden: pathInfo.isHidden,
    isSymlink: pathInfo.isSymlink,
    size: pathInfo.size,
    mtime: pathInfo.mtime,
  }
}
