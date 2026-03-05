import { retryTask } from "@/services/tasks/task.service"

import { mapTaskRouteError, taskJson } from "../../utils"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { taskId } = await context.params

  try {
    const task = await retryTask({
      taskId,
    })

    return taskJson({
      ok: true,
      task,
    })
  } catch (error) {
    const mapped = mapTaskRouteError(error, "Failed to retry task.")
    return taskJson(
      {
        ok: false,
        error: mapped.payload,
      },
      mapped.status,
    )
  }
}
