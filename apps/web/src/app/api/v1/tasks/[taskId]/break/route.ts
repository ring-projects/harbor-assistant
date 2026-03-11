import { proxyToService } from "@/lib/service-proxy"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    taskId: string
  }>
}

export async function POST(request: Request, context: RouteContext) {
  const { taskId } = await context.params

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    payload = null
  }

  return proxyToService({
    path: `/v1/tasks/${encodeURIComponent(taskId)}/break`,
    method: "POST",
    payload,
  })
}
