import { proxyToService } from "@/lib/service-proxy"

export const runtime = "nodejs"

export async function GET() {
  return proxyToService({
    path: "/v1/projects",
    method: "GET",
  })
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    payload = null
  }

  return proxyToService({
    path: "/v1/projects",
    method: "POST",
    payload,
  })
}
