import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { createTaskAndRun } from "@/services/tasks/task.service"

import { mapTaskRouteError, taskJson } from "./utils"

export const runtime = "nodejs"

const CreateTaskInputSchema = z.object({
  projectId: z.string(),
  prompt: z.string(),
  model: z.string().optional(),
  executor: z.string().optional(),
})

export async function POST(request: Request) {
  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return taskJson(
      {
        ok: false,
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message: "Request body must be valid JSON.",
        },
      },
      400,
    )
  }

  const parsed = CreateTaskInputSchema.safeParse(requestBody)
  if (!parsed.success) {
    return taskJson(
      {
        ok: false,
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message:
            "Expected payload: { projectId: string; prompt: string; model?: string; executor?: string }.",
        },
      },
      400,
    )
  }

  try {
    const task = await createTaskAndRun(parsed.data)
    return taskJson({
      ok: true,
      task,
    })
  } catch (error) {
    const mapped = mapTaskRouteError(error, "Failed to create task.")
    return taskJson(
      {
        ok: false,
        error: mapped.payload,
      },
      mapped.status,
    )
  }
}
