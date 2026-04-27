import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import type { DocumentContentStore } from "../application/document-content-store"
import type { DocumentWorkspacePolicy } from "../application/document-workspace-policy"
import { createDocumentError } from "../errors"

export function createNodeDocumentContentStore(
  workspacePolicy: DocumentWorkspacePolicy,
): DocumentContentStore {
  return {
    async write(input) {
      const resolved = await workspacePolicy.resolveDocumentPath({
        projectRootPath: input.projectRootPath,
        path: input.path,
      })

      try {
        await mkdir(path.dirname(resolved.absolutePath), { recursive: true })
        await writeFile(resolved.absolutePath, input.content, "utf8")
      } catch (error) {
        throw createDocumentError().conflict(
          error instanceof Error
            ? error.message
            : "document content write failed",
        )
      }
    },
    async read(input) {
      const resolved = await workspacePolicy.resolveDocumentPath({
        projectRootPath: input.projectRootPath,
        path: input.path,
      })

      try {
        const content = await readFile(resolved.absolutePath, "utf8")
        const format: "markdown" | "json" = resolved.absolutePath.endsWith(
          ".json",
        )
          ? "json"
          : "markdown"

        return {
          path: input.path,
          format,
          content,
        }
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          throw createDocumentError().contentMissing()
        }

        throw createDocumentError().conflict(
          error instanceof Error
            ? error.message
            : "document content read failed",
        )
      }
    },
    async delete(input) {
      const resolved = await workspacePolicy.resolveDocumentPath({
        projectRootPath: input.projectRootPath,
        path: input.path,
      })

      try {
        await rm(resolved.absolutePath, { force: true })
      } catch (error) {
        throw createDocumentError().conflict(
          error instanceof Error
            ? error.message
            : "document content delete failed",
        )
      }
    },
  }
}
