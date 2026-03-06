import { proxyToService } from "@/lib/service-proxy"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  const { taskId } = await context.params
  const url = new URL(request.url)

  return proxyToService({
    path: `/v1/tasks/${encodeURIComponent(taskId)}/conversation${url.search}`,
    method: "GET",
  })
}
