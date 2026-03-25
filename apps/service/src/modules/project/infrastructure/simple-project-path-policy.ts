import { createProjectError } from "../errors"
import type { ProjectPathPolicy } from "../application/project-path-policy"

export function createSimpleProjectPathPolicy(): ProjectPathPolicy {
  return {
    async canonicalizeProjectRoot(rawPath: string) {
      const trimmed = rawPath.trim()
      if (!trimmed) {
        throw createProjectError().invalidInput("rootPath is required")
      }

      return trimmed
        .replace(/^~\//, "/resolved/")
        .replace(/\/+/g, "/")
    },
  }
}
