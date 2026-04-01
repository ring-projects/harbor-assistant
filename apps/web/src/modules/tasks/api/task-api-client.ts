import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import { parseJsonResponse } from "@/lib/protocol"
import {
  type TaskAgentEventStream,
  type TaskDetail,
  type TaskEffort,
  type TaskListItem,
} from "@/modules/tasks/contracts"
import {
  type TaskInput,
  type UploadedTaskInputImage,
} from "@/modules/tasks/lib"
import {
  extractSingleTask,
  extractTaskEvents,
  extractTaskList,
} from "./task-payload"

const taskApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
})

type TaskApiError = z.infer<typeof taskApiErrorSchema>

type TaskEnvelopePayload = {
  ok?: boolean
  error?: TaskApiError
} & Record<string, unknown>

type UploadTaskInputImageEnvelopePayload = TaskEnvelopePayload & {
  path?: string
  mediaType?: string
  name?: string
  size?: number
}

type DeleteTaskEnvelopePayload = TaskEnvelopePayload & {
  taskId?: string
  projectId?: string
  orchestrationId?: string
}

export class TaskApiClientError extends Error {
  code: string
  status: number

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message)
    this.name = "TaskApiClientError"
    this.code = options?.code ?? ERROR_CODES.INTERNAL_ERROR
    this.status = options?.status ?? 500
  }
}

export type CreateTaskInput = {
  prompt?: string
  items?: Extract<TaskInput, readonly unknown[]>
  title?: string
  model: string
  executor: string
  executionMode: "safe" | "connected" | "full-access"
  effort: TaskEffort
}

export type ResumeTaskInput = {
  prompt?: string
  items?: Extract<TaskInput, readonly unknown[]>
  model?: string | null
  effort?: TaskEffort | null
}

export type CancelTaskInput = {
  reason?: string
}

export type CreateTaskResult = {
  id: string
  task?: TaskDetail
}

export type DeleteTaskResult = {
  taskId: string
  projectId: string
  orchestrationId: string
}

export type TaskListResult = {
  tasks: TaskListItem[]
  nextCursor: string | null
}

export type UploadTaskInputImageInput = {
  file: File
}

const TASK_INPUT_IMAGE_MAX_BYTES = 10 * 1024 * 1024
const TASK_INPUT_FILE_MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  yml: "application/yaml",
  yaml: "application/yaml",
}
const SUPPORTED_TASK_INPUT_IMAGE_MEDIA_TYPES = new Set([
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

function inferTaskInputFileMediaType(file: File) {
  const explicit = file.type.trim().toLowerCase()
  if (SUPPORTED_TASK_INPUT_IMAGE_MEDIA_TYPES.has(explicit)) {
    return explicit
  }

  const extension = file.name.split(".").at(-1)?.trim().toLowerCase() ?? ""
  return TASK_INPUT_FILE_MEDIA_TYPE_BY_EXTENSION[extension] ?? explicit
}

async function parseJson<T extends TaskEnvelopePayload = TaskEnvelopePayload>(
  response: Response,
): Promise<T | null> {
  return parseJsonResponse<T>(response)
}

function throwIfFailed(
  response: Response,
  payload: TaskEnvelopePayload | null,
  fallbackMessage: string,
) {
  const parsedError = taskApiErrorSchema.safeParse(payload?.error)

  if (response.ok && payload?.ok !== false) {
    return
  }

  throw new TaskApiClientError(
    parsedError.success ? parsedError.data.message : fallbackMessage,
    {
      status: response.status,
      code: parsedError.success
        ? parsedError.data.code
        : ERROR_CODES.INTERNAL_ERROR,
    },
  )
}

export async function createTask(args: {
  projectId: string
  orchestrationId: string
  input: CreateTaskInput
}): Promise<CreateTaskResult> {
  const body: Record<string, unknown> = {
    projectId: args.projectId,
    orchestrationId: args.orchestrationId,
    title: args.input.title,
    model: args.input.model,
    executor: args.input.executor,
    executionMode: args.input.executionMode,
    effort: args.input.effort,
  }

  if (args.input.items) {
    body.items = args.input.items
  } else {
    body.prompt = args.input.prompt
  }

  const response = await fetch(
    buildExecutorApiUrl(
      `/v1/orchestrations/${encodeURIComponent(args.orchestrationId)}/tasks`,
    ),
    {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to create task.")

  const task = extractSingleTask(payload)
  const id = task?.id ?? null

  if (!id) {
    throw new TaskApiClientError("Task created but id is missing.", {
      code: ERROR_CODES.TASK_START_FAILED,
      status: response.status,
    })
  }

  return {
    id,
    task: task ?? undefined,
  }
}

export async function readOrchestrationTasks(args: {
  orchestrationId: string
  includeArchived?: boolean
}): Promise<TaskListResult> {
  const searchParams = new URLSearchParams()
  if (args.includeArchived) {
    searchParams.set("includeArchived", "true")
  }

  const response = await fetch(
    buildExecutorApiUrl(
      `/v1/orchestrations/${encodeURIComponent(args.orchestrationId)}/tasks${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`,
    ),
    {
      method: "GET",
      cache: "no-store",
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load tasks.")

  return {
    tasks: extractTaskList(payload),
    nextCursor: null,
  }
}

export async function readTaskDetail(taskId: string): Promise<TaskDetail> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/tasks/${encodeURIComponent(taskId)}`),
    {
      method: "GET",
      cache: "no-store",
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load task detail.")

  const task = extractSingleTask(payload)

  if (!task) {
    throw new TaskApiClientError("Task detail payload is invalid.", {
      code: ERROR_CODES.TASK_NOT_FOUND,
      status: response.status,
    })
  }

  return task
}

export async function readTaskEvents(args: {
  taskId: string
  afterSequence?: number
  limit?: number
}): Promise<TaskAgentEventStream> {
  const searchParams = new URLSearchParams()

  if (typeof args.afterSequence === "number" && Number.isFinite(args.afterSequence)) {
    searchParams.set(
      "afterSequence",
      String(Math.max(0, Math.trunc(args.afterSequence))),
    )
  }

  if (typeof args.limit === "number" && Number.isFinite(args.limit)) {
    searchParams.set("limit", String(Math.max(1, Math.trunc(args.limit))))
  }

  const query = searchParams.toString()
  const response = await fetch(
    buildExecutorApiUrl(
      `/v1/tasks/${encodeURIComponent(args.taskId)}/events${query ? `?${query}` : ""}`,
    ),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to load task events.")

  const events = extractTaskEvents(payload)
  if (!events) {
    throw new TaskApiClientError("Task events payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return events
}

export async function archiveTask(taskId: string): Promise<TaskDetail> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/tasks/${encodeURIComponent(taskId)}/archive`),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to archive task.")

  const task = extractSingleTask(payload)
  if (!task) {
    throw new TaskApiClientError("Archive succeeded but task payload is invalid.", {
      code: ERROR_CODES.TASK_ARCHIVE_FAILED,
      status: response.status,
    })
  }

  return task
}

export async function resumeTask(
  taskId: string,
  input: ResumeTaskInput,
): Promise<TaskDetail> {
  const body: Record<string, unknown> = input.items
    ? { items: input.items }
    : { prompt: input.prompt }

  if ("model" in input) {
    body.model = input.model ?? null
  }

  if ("effort" in input) {
    body.effort = input.effort ?? null
  }

  const response = await fetch(
    buildExecutorApiUrl(`/v1/tasks/${encodeURIComponent(taskId)}/resume`),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to resume task.")

  const task = extractSingleTask(payload)
  if (!task) {
    throw new TaskApiClientError("Resume succeeded but task payload is invalid.", {
      code: ERROR_CODES.TASK_RESUME_FAILED,
      status: response.status,
    })
  }

  return task
}

export async function cancelTask(
  taskId: string,
  input: CancelTaskInput = {},
): Promise<TaskDetail> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/tasks/${encodeURIComponent(taskId)}/cancel`),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(
        input.reason?.trim()
          ? {
              reason: input.reason.trim(),
            }
          : {},
      ),
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to cancel task.")

  const task = extractSingleTask(payload)
  if (!task) {
    throw new TaskApiClientError("Cancel succeeded but task payload is invalid.", {
      code: ERROR_CODES.TASK_CANCEL_FAILED,
      status: response.status,
    })
  }

  return task
}

function encodeBytesToBase64(bytes: Uint8Array) {
  let binary = ""
  for (const value of bytes) {
    binary += String.fromCharCode(value)
  }

  return btoa(binary)
}

async function readFileBytes(file: File) {
  if (typeof file.arrayBuffer === "function") {
    return new Uint8Array(await file.arrayBuffer())
  }

  if (typeof FileReader !== "undefined") {
    return await new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader()

      reader.onerror = () => {
        reject(reader.error ?? new Error("Failed to read file."))
      }
      reader.onload = () => {
        if (!(reader.result instanceof ArrayBuffer)) {
          reject(new Error("Failed to read file."))
          return
        }

        resolve(new Uint8Array(reader.result))
      }

      reader.readAsArrayBuffer(file)
    })
  }

  return new Uint8Array(await new Response(await file.text()).arrayBuffer())
}

export async function uploadTaskInputImage(
  projectId: string,
  input: UploadTaskInputImageInput,
): Promise<UploadedTaskInputImage> {
  const file = input.file
  const mediaType = inferTaskInputFileMediaType(file)

  if (!SUPPORTED_TASK_INPUT_IMAGE_MEDIA_TYPES.has(mediaType)) {
    throw new TaskApiClientError(
      "Only PNG, JPEG, WebP, GIF, PDF, TXT, Markdown, CSV, JSON, and YAML files are supported.",
      {
        code: ERROR_CODES.INVALID_REQUEST_BODY,
        status: 400,
      },
    )
  }

  if (typeof file.size === "number" && file.size <= 0) {
    throw new TaskApiClientError("File payload is empty.", {
      code: ERROR_CODES.INVALID_REQUEST_BODY,
      status: 400,
    })
  }

  if (typeof file.size === "number" && file.size > TASK_INPUT_IMAGE_MAX_BYTES) {
    throw new TaskApiClientError("File payload exceeds 10MB limit.", {
      code: ERROR_CODES.INVALID_REQUEST_BODY,
      status: 400,
    })
  }

  const bytes = await readFileBytes(file)

  if (bytes.length === 0) {
    throw new TaskApiClientError("File payload is empty.", {
      code: ERROR_CODES.INVALID_REQUEST_BODY,
      status: 400,
    })
  }

  if (bytes.length > TASK_INPUT_IMAGE_MAX_BYTES) {
    throw new TaskApiClientError("File payload exceeds 10MB limit.", {
      code: ERROR_CODES.INVALID_REQUEST_BODY,
      status: 400,
    })
  }

  const response = await fetch(
    buildExecutorApiUrl(
      `/v1/projects/${encodeURIComponent(projectId)}/task-input-files`,
    ),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: file.name,
        mediaType,
        dataBase64: encodeBytesToBase64(bytes),
      }),
    },
  )

  const payload = await parseJson<UploadTaskInputImageEnvelopePayload>(response)
  throwIfFailed(response, payload, "Failed to upload task input image.")

  const path = typeof payload?.path === "string" ? payload.path : null
  const uploadedMediaType =
    typeof payload?.mediaType === "string" ? payload.mediaType : null
  const name = typeof payload?.name === "string" ? payload.name : null
  const size =
    typeof payload?.size === "number" && Number.isFinite(payload.size)
      ? payload.size
      : null

  if (!path || !uploadedMediaType || !name || size === null) {
    throw new TaskApiClientError("Task input image payload is invalid.", {
      code: ERROR_CODES.INTERNAL_ERROR,
      status: response.status,
    })
  }

  return {
    path,
    mediaType: uploadedMediaType,
    name,
    size,
  }
}

export async function deleteTask(taskId: string): Promise<DeleteTaskResult> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/tasks/${encodeURIComponent(taskId)}`),
    {
      method: "DELETE",
    },
  )

  const payload = await parseJson<DeleteTaskEnvelopePayload>(response)
  throwIfFailed(response, payload, "Failed to delete task.")

  const nextTaskId = typeof payload?.taskId === "string" ? payload.taskId : null
  const projectId =
    typeof payload?.projectId === "string" ? payload.projectId : null
  const orchestrationId =
    typeof payload?.orchestrationId === "string"
      ? payload.orchestrationId
      : null

  if (!nextTaskId || !projectId || !orchestrationId) {
    throw new TaskApiClientError("Delete succeeded but payload is invalid.", {
      code: ERROR_CODES.TASK_DELETE_FAILED,
      status: response.status,
    })
  }

  return {
    taskId: nextTaskId,
    projectId,
    orchestrationId,
  }
}
