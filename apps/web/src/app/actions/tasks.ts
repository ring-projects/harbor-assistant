"use server"

import { revalidatePath } from "next/cache"

import { ERROR_CODES } from "@/constants"
import {
  TaskServiceError,
  createTaskAndRun,
} from "@/services/tasks/task.service"

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

  try {
    const task = await createTaskAndRun({
      projectId,
      prompt,
      model,
      executor: "codex",
    })

    revalidatePath(`/${projectId}/tasks`)
    return {
      ok: true,
      taskId: task.id,
    }
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
        },
      }
    }

    return {
      ok: false,
      error: {
        code: ERROR_CODES.TASK_START_FAILED,
        message: `Failed to start Codex task: ${String(error)}`,
      },
    }
  }
}
