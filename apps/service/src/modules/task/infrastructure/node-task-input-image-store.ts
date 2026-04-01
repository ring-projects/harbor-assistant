import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import type { TaskInputFileStore } from "../application/task-input-image-store"

const TASK_INPUT_IMAGE_DIRECTORY = ".harbor/task-input-images"
const TASK_INPUT_FILE_DIRECTORY = ".harbor/task-input-files"

function sanitizeFileName(name: string) {
  const trimmed = path.basename(name.trim())
  const fallback = "image"
  const normalized = (trimmed || fallback).replace(/[^A-Za-z0-9._-]+/g, "-")
  return normalized.replace(/-+/g, "-") || fallback
}

function resolveAttachmentDirectory(mediaType: string) {
  return mediaType.startsWith("image/")
    ? TASK_INPUT_IMAGE_DIRECTORY
    : TASK_INPUT_FILE_DIRECTORY
}

export function createNodeTaskInputFileStore(): TaskInputFileStore {
  return {
    async save(input) {
      const sanitizedName = sanitizeFileName(input.name)
      const storedFileName = `${randomUUID()}-${sanitizedName}`
      const relativeDirectory = resolveAttachmentDirectory(input.mediaType)
      const relativePath = `${relativeDirectory}/${storedFileName}`
      const absoluteDirectory = path.join(
        input.projectPath,
        relativeDirectory,
      )
      const absolutePath = path.join(input.projectPath, relativePath)

      await mkdir(absoluteDirectory, { recursive: true })
      await writeFile(absolutePath, input.content)

      return {
        path: relativePath,
        size: input.content.length,
      }
    },
  }
}

export const createNodeTaskInputImageStore = createNodeTaskInputFileStore
