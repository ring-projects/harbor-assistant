import path from "node:path"

import { normalizeOutputPath } from "../domain/path-policy"

export function toBootstrapRelativePath(
  rootPath: string,
  absolutePath: string,
) {
  const relativePath = path.relative(rootPath, absolutePath)

  if (!relativePath) {
    return null
  }

  return normalizeOutputPath(relativePath)
}
