import "server-only"

import { requestServiceJson } from "@/lib/service-proxy"
import type { Project } from "@/services/project/types"

export async function listProjectsFromService(): Promise<Project[]> {
  const response = await requestServiceJson<{
    ok: boolean
    projects?: Project[]
  }>({
    path: "/v1/projects",
    method: "GET",
  })

  if (!response.body?.ok) {
    return []
  }

  return response.body.projects ?? []
}
