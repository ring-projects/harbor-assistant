import { proxyToService } from "@/lib/service-proxy"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{
    id: string
  }>
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
    path: `/v1/projects/${encodeURIComponent(id)}`,
    method: "PUT",
    payload,
  })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params
  return proxyToService({
    path: `/v1/projects/${encodeURIComponent(id)}`,
    method: "DELETE",
  })
}
