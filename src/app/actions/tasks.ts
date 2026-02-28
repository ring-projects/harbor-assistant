"use server"

import { revalidatePath } from "next/cache"

import { createAndRunCodexTask } from "@/services/tasks/task-runner.service"
import { getProjectById } from "@/services/project/project.repository"

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
        code: "INVALID_PROJECT_ID",
        message: "Project id is required.",
      },
    }
  }

  if (!prompt) {
    return {
      ok: false,
      error: {
        code: "INVALID_PROMPT",
        message: "Prompt cannot be empty.",
      },
    }
  }

  const project = await getProjectById(projectId)
  if (!project) {
    return {
      ok: false,
      error: {
        code: "PROJECT_NOT_FOUND",
        message: `Project not found: ${projectId}`,
      },
    }
  }

  try {
    const task = await createAndRunCodexTask({
      projectId: project.id,
      projectPath: project.path,
      prompt,
      model,
    })

    revalidatePath(`/${projectId}/tasks`)
    return {
      ok: true,
      taskId: task.id,
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "TASK_START_FAILED",
        message: `Failed to start Codex task: ${String(error)}`,
      },
    }
  }
}
