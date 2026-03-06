import { proxyToService } from "@/lib/service-proxy"

export const runtime = "nodejs"

export async function GET() {
  return proxyToService({
    path: "/v1/executors/capabilities",
    method: "GET",
  })
}
