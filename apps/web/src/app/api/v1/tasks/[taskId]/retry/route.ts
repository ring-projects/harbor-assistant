import { proxyToService } from "@/lib/service-proxy"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

export async function POST(_request: Request, context: RouteContext) {
  const { taskId } = await context.params

  return proxyToService({
    path: `/v1/tasks/${encodeURIComponent(taskId)}/retry`,
    method: "POST",
  })
}
