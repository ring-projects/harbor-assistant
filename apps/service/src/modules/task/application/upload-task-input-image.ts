import { createTaskError, isTaskError } from "../errors"
import type { ProjectTaskPort } from "./project-task-port"
import type { TaskInputFileStore } from "./task-input-image-store"

const TASK_INPUT_FILE_MAX_BYTES = 10 * 1024 * 1024
const SUPPORTED_TASK_INPUT_FILE_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
])

function decodeBase64(value: string) {
  const normalized = value.trim()
  if (!normalized) {
    throw createTaskError().invalidInput("dataBase64 is required")
  }

  return Buffer.from(normalized, "base64")
}

export async function uploadTaskInputFileUseCase(args: {
  projectTaskPort: ProjectTaskPort
  taskInputFileStore: TaskInputFileStore
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
  if (!SUPPORTED_TASK_INPUT_FILE_MEDIA_TYPES.has(mediaType)) {
    throw createTaskError().invalidInput("unsupported task input file media type")
  }

  const project = await args.projectTaskPort.getProjectForTask(projectId)
  if (!project) {
    throw createTaskError().projectNotFound()
  }

  const content = decodeBase64(input.dataBase64)
  if (content.length === 0) {
    throw createTaskError().invalidInput("file payload is empty")
  }
  if (content.length > TASK_INPUT_FILE_MAX_BYTES) {
    throw createTaskError().invalidInput("file payload exceeds 10MB limit")
  }

  let storedImage: {
    path: string
    size: number
  }

  try {
    storedImage = await args.taskInputFileStore.save({
      projectPath: project.rootPath,
      name,
      mediaType,
      content,
    })
  } catch (error) {
    if (isTaskError(error)) {
      throw error
    }

    throw createTaskError().uploadInputImageFailed(
      error instanceof Error ? error.message : "task input image upload failed",
    )
  }

  return {
    path: storedImage.path,
    mediaType,
    name,
    size: storedImage.size,
  }
}

export const uploadTaskInputImageUseCase = uploadTaskInputFileUseCase
