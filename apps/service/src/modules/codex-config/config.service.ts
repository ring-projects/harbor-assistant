import { homedir } from "node:os"
import path from "node:path"
import { mkdir, readFile, writeFile } from "node:fs/promises"

import { CODEX_CONFIG_PATH } from "../../lib/agents"

type CodexConfigScope = "global" | "project"

function getGlobalCodexConfigPath() {
  return path.join(homedir(), CODEX_CONFIG_PATH)
}

function getProjectCodexConfigPath(projectPath: string) {
  return path.join(projectPath, CODEX_CONFIG_PATH)
}

function parseSectionName(line: string) {
  const match = line.trim().match(/^\[(.+)\]$/)
  return match ? match[1].trim() : null
}

function normalizeSectionKey(key: string) {
  return key.replace(/^"+|"+$/g, "")
}

function getMcpSectionCandidates(serverName: string) {
  return new Set([
    `mcp_servers.${serverName}`,
    `mcp_servers."${serverName}"`,
    `mcp_servers.'${serverName}'`,
  ])
}

function setMcpServerEnabledInToml(args: {
  content: string
  serverName: string
  enabled: boolean
}) {
  const { content, serverName, enabled } = args
  const lines = content.length > 0 ? content.split(/\r?\n/) : []
  const candidates = getMcpSectionCandidates(serverName)
  let sectionStart = -1
  let sectionEnd = -1

  for (let index = 0; index < lines.length; index += 1) {
    const sectionName = parseSectionName(lines[index])
    if (!sectionName) {
      continue
    }

    const normalizedSectionName = normalizeSectionKey(sectionName)
    if (sectionStart >= 0) {
      sectionEnd = index
      break
    }

    if (candidates.has(normalizedSectionName) || candidates.has(sectionName)) {
      sectionStart = index
    }
  }

  if (sectionStart >= 0 && sectionEnd < 0) {
    sectionEnd = lines.length
  }

  const nextEnabledLine = `enabled = ${enabled ? "true" : "false"}`

  if (sectionStart >= 0 && sectionEnd >= 0) {
    let enabledLineIndex = -1
    for (let index = sectionStart + 1; index < sectionEnd; index += 1) {
      if (/^\s*enabled\s*=/.test(lines[index])) {
        enabledLineIndex = index
        break
      }
    }

    if (enabledLineIndex >= 0) {
      lines[enabledLineIndex] = nextEnabledLine
    } else {
      lines.splice(sectionEnd, 0, nextEnabledLine)
    }

    return lines.join("\n")
  }

  const nextLines = [...lines]
  if (nextLines.length > 0 && nextLines[nextLines.length - 1].trim() !== "") {
    nextLines.push("")
  }
  nextLines.push(`[mcp_servers."${serverName.replace(/"/g, '\\"')}"]`)
  nextLines.push(nextEnabledLine)
  return nextLines.join("\n")
}

async function setMcpServerEnabled(args: {
  scope: CodexConfigScope
  projectPath: string | null
  serverName: string
  enabled: boolean
}) {
  const serverName = args.serverName.trim()
  if (!serverName) {
    return
  }

  const configPath =
    args.scope === "global"
      ? getGlobalCodexConfigPath()
      : getProjectCodexConfigPath(args.projectPath ?? "")

  const configDir = path.dirname(configPath)
  await mkdir(configDir, { recursive: true })

  const existingContent = (
    await readFile(configPath, "utf8").catch(() => "")
  ).replace(/\r\n/g, "\n")

  const nextContent = setMcpServerEnabledInToml({
    content: existingContent,
    serverName,
    enabled: args.enabled,
  })

  await writeFile(configPath, `${nextContent}\n`, "utf8")
}

export async function setProjectMcpServerEnabled(args: {
  projectPath: string
  serverName: string
  enabled: boolean
}) {
  await setMcpServerEnabled({
    scope: "project",
    projectPath: args.projectPath,
    serverName: args.serverName,
    enabled: args.enabled,
  })
}

export async function setGlobalMcpServerEnabled(args: {
  serverName: string
  enabled: boolean
}) {
  await setMcpServerEnabled({
    scope: "global",
    projectPath: null,
    serverName: args.serverName,
    enabled: args.enabled,
  })
}
