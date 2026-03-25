import os from "node:os"
import path from "node:path"

import type { ProjectPathPolicy } from "../application/project-path-policy"
import { createProjectError } from "../errors"

export function createNodeProjectPathPolicy(): ProjectPathPolicy {
  return {
    async canonicalizeProjectRoot(rawPath: string) {
      const trimmed = rawPath.trim()
      if (!trimmed) {
        throw createProjectError().invalidInput("rootPath is required")
      }

      const expandedPath = trimmed.startsWith("~/")
        ? path.join(os.homedir(), trimmed.slice(2))
        : trimmed

      return path.resolve(expandedPath)
    },
  }
}
