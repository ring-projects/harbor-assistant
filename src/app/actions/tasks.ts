"use server"

import { revalidatePath } from "next/cache"

import { createAndRunCodexTask } from "@/services/tasks/task-runner.service"
import { getWorkspaceById } from "@/services/workspace/workspace.repository"

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
  workspaceId: string
  prompt: string
  model?: string
}): Promise<CreateTaskActionResult> {
  const workspaceId = input.workspaceId.trim()
  const prompt = input.prompt.trim()
  const model = input.model?.trim() || null

  if (!workspaceId) {
    return {
      ok: false,
      error: {
        code: "INVALID_WORKSPACE_ID",
        message: "Workspace id is required.",
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

  const workspace = await getWorkspaceById(workspaceId)
  if (!workspace) {
    return {
      ok: false,
      error: {
        code: "WORKSPACE_NOT_FOUND",
        message: `Workspace not found: ${workspaceId}`,
      },
    }
  }

  try {
    const task = await createAndRunCodexTask({
      workspaceId: workspace.id,
      workspacePath: workspace.path,
      prompt,
      model,
    })

    revalidatePath(`/${workspaceId}/tasks`)
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
