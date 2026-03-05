import { z } from "zod"

import { ERROR_CODES } from "@/constants"
import { cancelTask } from "@/services/tasks/task.service"

import { mapTaskRouteError, taskJson } from "../../utils"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

const CancelTaskInputSchema = z.object({
  reason: z.string().optional(),
})

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params

  let requestBody: unknown = {}
  if (request.headers.get("content-length")) {
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
  }

  const parsed = CancelTaskInputSchema.safeParse(requestBody)
  if (!parsed.success) {
    return taskJson(
      {
        ok: false,
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message: "Expected payload: { reason?: string }.",
        },
      },
      400,
    )
  }

  try {
    const task = await cancelTask({
      taskId,
      reason: parsed.data.reason,
    })

    return taskJson({
      ok: true,
      task,
    })
  } catch (error) {
    const mapped = mapTaskRouteError(error, "Failed to cancel task.")
    return taskJson(
      {
        ok: false,
        error: mapped.payload,
      },
      mapped.status,
    )
  }
}
