import { proxyToService } from "@/lib/service-proxy"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    projectId: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params

  return proxyToService({
    path: `/v1/projects/${encodeURIComponent(projectId)}/git/diff`,
    method: "GET",
  })
}
