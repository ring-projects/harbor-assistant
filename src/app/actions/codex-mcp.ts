"use server"

import { revalidatePath } from "next/cache"

import {
  setGlobalMcpServerEnabled,
  setProjectMcpServerEnabled,
} from "@/services/codex-config/config.service"
import { getWorkspaceById } from "@/services/workspace/workspace.repository"

export async function setMcpServerEnabledAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "").trim()
  const serverName = String(formData.get("serverName") ?? "").trim()
  const scope = String(formData.get("scope") ?? "").trim().toLowerCase()
  const enabledRaw = String(formData.get("enabled") ?? "").trim().toLowerCase()

  if (
    !workspaceId ||
    !serverName ||
    (scope !== "global" && scope !== "project") ||
    (enabledRaw !== "true" && enabledRaw !== "false")
  ) {
    return
  }

  if (scope === "global") {
    await setGlobalMcpServerEnabled({
      serverName,
      enabled: enabledRaw === "true",
    })
  } else {
    const workspace = await getWorkspaceById(workspaceId)
    if (!workspace) {
      return
    }

    await setProjectMcpServerEnabled({
      workspacePath: workspace.path,
      serverName,
      enabled: enabledRaw === "true",
    })
  }

  revalidatePath(`/${workspaceId}/mcp`)
}
