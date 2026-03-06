"use server"

import { revalidatePath } from "next/cache"

import { ERROR_CODES } from "@/constants"
import { requestServiceJson } from "@/lib/service-proxy"

type CreateTaskActionError = {
  code: string
  message: string
}

export type CreateTaskActionResult = {
  ok: boolean
  taskId?: string
  error?: CreateTaskActionError
}

export async function createCodexTaskAction(input: {
  projectId: string
  prompt: string
  model?: string
}): Promise<CreateTaskActionResult> {
  const projectId = input.projectId.trim()
  const prompt = input.prompt.trim()
  const model = input.model?.trim() || null

  if (!projectId) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.INVALID_PROJECT_ID,
        message: "Project id is required.",
      },
    }
  }

  if (!prompt) {
    return {
      ok: false,
      error: {
        code: ERROR_CODES.INVALID_PROMPT,
        message: "Prompt cannot be empty.",
      },
    }
  }

  const response = await requestServiceJson<{
    ok: boolean
    task?: {
      id: string
    }
    error?: CreateTaskActionError
  }>({
    path: "/v1/tasks",
    method: "POST",
    payload: {
      projectId,
      prompt,
      model,
      executor: "codex",
    },
  })

  if (!response.body?.ok || !response.body.task?.id) {
    return {
      ok: false,
      error:
        response.body?.error ?? {
          code: ERROR_CODES.TASK_START_FAILED,
          message: "Failed to start Codex task.",
        },
    }
  }

  revalidatePath(`/${projectId}/tasks`)
  return {
    ok: true,
    taskId: response.body.task.id,
  }
}
