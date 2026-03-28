import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { createTaskError } from "../errors"
import type { ProjectTaskPort } from "./project-task-port"

const TASK_INPUT_IMAGE_DIRECTORY = ".harbor/task-input-images"
const TASK_INPUT_IMAGE_MAX_BYTES = 10 * 1024 * 1024
const SUPPORTED_TASK_INPUT_IMAGE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
])

function sanitizeFileName(name: string) {
  const trimmed = path.basename(name.trim())
  const fallback = "image"
  const normalized = (trimmed || fallback).replace(/[^A-Za-z0-9._-]+/g, "-")
  return normalized.replace(/-+/g, "-") || fallback
}

function decodeBase64(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw createTaskError().invalidInput("dataBase64 is required")
  }

  return Buffer.from(normalized, "base64")
}

function toRelativeOutputPath(fileName: string) {
  return `${TASK_INPUT_IMAGE_DIRECTORY}/${fileName}`
}

export async function uploadTaskInputImageUseCase(args: {
  projectTaskPort: ProjectTaskPort
}, input: {
  projectId: string
  name: string
  mediaType: string
  dataBase64: string
}): Promise<{
  path: string
  mediaType: string
  name: string
  size: number
}> {
  const projectId = input.projectId.trim()
  const name = input.name.trim()
  const mediaType = input.mediaType.trim().toLowerCase()

  if (!projectId) {
    throw createTaskError().invalidInput("projectId is required")
  }
  if (!name) {
    throw createTaskError().invalidInput("name is required")
  }
  if (!SUPPORTED_TASK_INPUT_IMAGE_MEDIA_TYPES.has(mediaType)) {
    throw createTaskError().invalidInput("unsupported image media type")
  }

  const project = await args.projectTaskPort.getProjectForTask(projectId)
  if (!project) {
    throw createTaskError().projectNotFound()
  }

  const content = decodeBase64(input.dataBase64)
  if (content.length === 0) {
    throw createTaskError().invalidInput("image payload is empty")
  }
  if (content.length > TASK_INPUT_IMAGE_MAX_BYTES) {
    throw createTaskError().invalidInput("image payload exceeds 10MB limit")
  }

  const sanitizedName = sanitizeFileName(name)
  const storedFileName = `${randomUUID()}-${sanitizedName}`
  const relativePath = toRelativeOutputPath(storedFileName)
  const absoluteDirectory = path.join(project.rootPath, TASK_INPUT_IMAGE_DIRECTORY)
  const absolutePath = path.join(project.rootPath, relativePath)

  await mkdir(absoluteDirectory, { recursive: true })
  await writeFile(absolutePath, content)

  return {
    path: relativePath,
    mediaType,
    name,
    size: content.length,
  }
}
