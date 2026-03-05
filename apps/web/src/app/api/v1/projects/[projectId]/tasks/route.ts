import { listProjectTasks } from "@/services/tasks/task.service"

import { mapTaskRouteError, taskJson } from "../../../tasks/utils"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    projectId: string
  }>
}

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return Math.trunc(parsed)
}

export async function GET(request: Request, context: RouteContext) {
  const { projectId } = await context.params
  const url = new URL(request.url)

  try {
    const tasks = await listProjectTasks({
      projectId,
      limit: parseLimit(url.searchParams.get("limit")),
    })

    return taskJson({
      ok: true,
      tasks,
    })
  } catch (error) {
    const mapped = mapTaskRouteError(error, "Failed to fetch project tasks.")
    return taskJson(
      {
        ok: false,
        tasks: [],
        error: mapped.payload,
      },
      mapped.status,
    )
  }
}
