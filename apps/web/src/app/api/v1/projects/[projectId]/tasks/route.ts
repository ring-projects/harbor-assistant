import { proxyToService } from "@/lib/service-proxy"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    projectId: string
  }>
}

export async function GET(request: Request, context: RouteContext) {
  const { projectId } = await context.params
  const url = new URL(request.url)

  return proxyToService({
    path: `/v1/projects/${encodeURIComponent(projectId)}/tasks${url.search}`,
    method: "GET",
  })
}
