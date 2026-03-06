"use server"

import { revalidatePath } from "next/cache"

import { requestServiceJson } from "@/lib/service-proxy"

export async function setMcpServerEnabledAction(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim()
  const serverName = String(formData.get("serverName") ?? "").trim()
  const scope = String(formData.get("scope") ?? "")
    .trim()
    .toLowerCase()
  const enabledRaw = String(formData.get("enabled") ?? "")
    .trim()
    .toLowerCase()

  if (
    !serverName ||
    (scope !== "global" && scope !== "project") ||
    (enabledRaw !== "true" && enabledRaw !== "false")
  ) {
    return
  }

  if (scope === "project" && !projectId) {
    return
  }

  await requestServiceJson<{
    ok: boolean
    error?: {
      code: string
      message: string
    }
  }>({
    path: "/v1/mcp/servers/enabled",
    method: "POST",
    payload: {
      projectId,
      serverName,
      scope,
      enabled: enabledRaw === "true",
    },
  })

  if (projectId) {
    revalidatePath(`/${projectId}/mcp`)
  }
}
