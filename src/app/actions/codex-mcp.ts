"use server"

import { revalidatePath } from "next/cache"

import {
  setGlobalMcpServerEnabled,
  setProjectMcpServerEnabled,
} from "@/services/codex-config/config.service"
import { getProjectById } from "@/services/project/project.repository"

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
    !projectId ||
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
    const project = await getProjectById(projectId)
    if (!project) {
      return
    }

    await setProjectMcpServerEnabled({
      projectPath: project.path,
      serverName,
      enabled: enabledRaw === "true",
    })
  }

  revalidatePath(`/${projectId}/mcp`)
}
