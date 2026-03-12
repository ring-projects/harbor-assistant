import { proxyToService } from "@/lib/service-proxy"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  return proxyToService({
    path: `/v1/projects/${encodeURIComponent(id)}/settings`,
    method: "GET",
  })
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    payload = null
  }

  return proxyToService({
    path: `/v1/projects/${encodeURIComponent(id)}/settings`,
    method: "PUT",
    payload,
  })
}
