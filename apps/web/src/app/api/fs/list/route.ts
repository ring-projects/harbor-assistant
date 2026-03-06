import { proxyToService } from "@/lib/service-proxy"

export const runtime = "nodejs"

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    payload = null
  }

  return proxyToService({
    path: "/v1/fs/list",
    method: "POST",
    payload,
  })
}
