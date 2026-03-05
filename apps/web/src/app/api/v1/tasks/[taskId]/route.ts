import { getTaskDetail } from "@/services/tasks/task.service"

import { mapTaskRouteError, taskJson } from "../utils"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { taskId } = await context.params

  try {
    const task = await getTaskDetail(taskId)
    return taskJson({
      ok: true,
      task,
    })
  } catch (error) {
    const mapped = mapTaskRouteError(error, "Failed to fetch task detail.")
    return taskJson(
      {
        ok: false,
        error: mapped.payload,
      },
      mapped.status,
    )
  }
}
