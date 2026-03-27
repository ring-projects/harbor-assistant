import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import { parseJsonResponse, pickString } from "@/lib/protocol"
import {
  type TaskAgentEventStream,
  type TaskDetail,
  type TaskListItem,
} from "@/modules/tasks/contracts"
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
  prompt: string
  title?: string
  model?: string
  executor?: string
  executionMode?: "safe" | "connected" | "full-access"
}

export type ResumeTaskInput = {
  prompt: string
}

export type CreateTaskResult = {
  taskId: string
  task?: TaskDetail
}

export type DeleteTaskResult = {
  taskId: string
  projectId: string
}

export type TaskListResult = {
  tasks: TaskListItem[]
  nextCursor: string | null
}

async function parseJson(response: Response): Promise<TaskEnvelopePayload | null> {
  return parseJsonResponse<TaskEnvelopePayload>(response)
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

export async function createTask(
  projectId: string,
  input: CreateTaskInput,
): Promise<CreateTaskResult> {
  const response = await fetch(buildExecutorApiUrl("/v1/tasks"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      projectId,
      prompt: input.prompt,
      title: input.title,
      model: input.model,
      executor: input.executor ?? "codex",
      executionMode: input.executionMode,
    }),
  })

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to create task.")

  const task = extractSingleTask(payload)
  const taskId = pickString(payload, "taskId", "id") ?? task?.taskId ?? null

  if (!taskId) {
    throw new TaskApiClientError("Task created but taskId is missing.", {
      code: ERROR_CODES.TASK_START_FAILED,
      status: response.status,
    })
  }

  return {
    taskId,
    task: task ?? undefined,
  }
}

export async function readProjectTasks(args: {
  projectId: string
  includeArchived?: boolean
}): Promise<TaskListResult> {
  const searchParams = new URLSearchParams()
  if (args.includeArchived) {
    searchParams.set("includeArchived", "true")
  }

  const response = await fetch(
    buildExecutorApiUrl(
      `/v1/projects/${encodeURIComponent(args.projectId)}/tasks${searchParams.size > 0 ? `?${searchParams.toString()}` : ""}`,
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
  const response = await fetch(
    buildExecutorApiUrl(`/v1/tasks/${encodeURIComponent(taskId)}/resume`),
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        prompt: input.prompt,
      }),
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

export async function deleteTask(taskId: string): Promise<DeleteTaskResult> {
  const response = await fetch(
    buildExecutorApiUrl(`/v1/tasks/${encodeURIComponent(taskId)}`),
    {
      method: "DELETE",
    },
  )

  const payload = await parseJson(response)
  throwIfFailed(response, payload, "Failed to delete task.")

  const nextTaskId = pickString(payload, "taskId", "id")
  const projectId = pickString(payload, "projectId")

  if (!nextTaskId || !projectId) {
    throw new TaskApiClientError("Delete succeeded but payload is invalid.", {
      code: ERROR_CODES.TASK_DELETE_FAILED,
      status: response.status,
    })
  }

  return {
    taskId: nextTaskId,
    projectId,
  }
}
