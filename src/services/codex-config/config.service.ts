import { access } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"

import { parseTomlMcpServers } from "@/services/codex-config/toml-lite"
import type {
  CodexConfigFileInfo,
  CodexConfigSource,
  CodexMcpConfigResult,
  CodexMcpServer,
  CodexSkill,
  CodexSkillFile,
  CodexSkillPreview,
  CodexSkillsResult,
} from "@/services/codex-config/types"

const SECRET_KEY_PATTERN = /(key|token|secret|password|authorization|auth)/i

type ParsedMcpServer = Omit<CodexMcpServer, "source" | "name">

function getGlobalCodexConfigPath() {
  return path.join(homedir(), ".codex", "config.toml")
}

function getProjectCodexConfigPath(workspacePath: string) {
  return path.join(workspacePath, ".codex", "config.toml")
}

function getGlobalSkillsRoot() {
  return path.join(homedir(), ".codex", "skills")
}

function getProjectSkillsRoot(workspacePath: string) {
  return path.join(workspacePath, ".codex", "skills")
}

function isInsideRoot(rootPath: string, targetPath: string) {
  const relative = path.relative(rootPath, targetPath)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

async function pathExists(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function toConfigFileInfo(filePath: string, exists: boolean): CodexConfigFileInfo {
  return {
    path: filePath,
    exists,
  }
}

function sanitizeArgValue(current: string, previousArg?: string) {
  if (SECRET_KEY_PATTERN.test(current)) {
    return "***"
  }

  if (previousArg && SECRET_KEY_PATTERN.test(previousArg)) {
    return "***"
  }

  const equalIndex = current.indexOf("=")
  if (equalIndex > 0) {
    const key = current.slice(0, equalIndex)
    const value = current.slice(equalIndex + 1)
    if (SECRET_KEY_PATTERN.test(key) && value) {
      return `${key}=***`
    }
  }

  return current
}

function sanitizeEnvMap(input?: Record<string, string>) {
  if (!input) {
    return {}
  }

  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    output[key] = SECRET_KEY_PATTERN.test(key) ? "***" : value
  }
  return output
}

function sanitizeServer(server: ParsedMcpServer): ParsedMcpServer {
  const args = (server.args ?? []).map((arg, index, all) =>
    sanitizeArgValue(arg, index > 0 ? all[index - 1] : undefined)
  )

  return {
    ...server,
    args,
    env: sanitizeEnvMap(server.env),
    headers: sanitizeEnvMap(server.headers),
  }
}

async function readMcpServersFromConfig(
  filePath: string
): Promise<Map<string, ParsedMcpServer>> {
  const exists = await pathExists(filePath)
  if (!exists) {
    return new Map()
  }

  const content = await readFile(filePath, "utf8")
  const parsed = parseTomlMcpServers(content)
  const output = new Map<string, ParsedMcpServer>()

  for (const [name, server] of parsed.entries()) {
    output.set(name, sanitizeServer({
      command: server.command,
      url: server.url,
      args: server.args ?? [],
      env: server.env ?? {},
      headers: server.headers ?? {},
      enabled: server.enabled,
    }))
  }

  return output
}

function mergeServers(
  existing: ParsedMcpServer | undefined,
  incoming: ParsedMcpServer
): ParsedMcpServer {
  if (!existing) {
    return incoming
  }

  return {
    command: incoming.command ?? existing.command,
    url: incoming.url ?? existing.url,
    enabled: incoming.enabled ?? existing.enabled,
    args: incoming.args.length > 0 ? incoming.args : existing.args,
    env: {
      ...existing.env,
      ...incoming.env,
    },
    headers: {
      ...existing.headers,
      ...incoming.headers,
    },
  }
}

export async function resolveCodexMcpConfigForWorkspace(
  workspacePath: string
): Promise<CodexMcpConfigResult> {
  const globalConfigPath = getGlobalCodexConfigPath()
  const projectConfigPath = getProjectCodexConfigPath(workspacePath)
  const [globalExists, projectExists] = await Promise.all([
    pathExists(globalConfigPath),
    pathExists(projectConfigPath),
  ])

  const globalServers = await readMcpServersFromConfig(globalConfigPath)
  const projectServers = await readMcpServersFromConfig(projectConfigPath)

  const serverNames = new Set<string>([
    ...Array.from(globalServers.keys()),
    ...Array.from(projectServers.keys()),
  ])

  const servers: CodexMcpServer[] = Array.from(serverNames.values())
    .map((name) => {
      const globalServer = globalServers.get(name)
      const projectServer = projectServers.get(name)
      const merged = projectServer
        ? mergeServers(globalServer, projectServer)
        : globalServer ?? {
            args: [],
            env: {},
            headers: {},
          }

      return {
        name,
        source: (projectServer ? "project" : "global") as CodexConfigSource,
        command: merged.command,
        url: merged.url,
        args: merged.args ?? [],
        env: merged.env ?? {},
        headers: merged.headers ?? {},
        enabled: merged.enabled,
        globalEnabled: globalServer?.enabled,
        projectEnabled: projectServer?.enabled,
      }
    })
    .sort((first, second) => first.name.localeCompare(second.name, "en"))

  return {
    globalConfig: toConfigFileInfo(globalConfigPath, globalExists),
    projectConfig: toConfigFileInfo(projectConfigPath, projectExists),
    servers,
  }
}

async function scanSkillDirectories(args: {
  rootPath: string
  source: CodexConfigSource
}): Promise<CodexSkill[]> {
  const rootExists = await pathExists(args.rootPath)
  if (!rootExists) {
    return []
  }

  const queue: string[] = [args.rootPath]
  const found = new Map<string, CodexSkill>()

  while (queue.length > 0) {
    const current = queue.pop()
    if (!current) {
      continue
    }

    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    const skillFileEntry = entries.find(
      (entry) => entry.isFile() && entry.name.toLowerCase() === "skill.md"
    )
    const hasSkillFile = Boolean(skillFileEntry)
    if (hasSkillFile && current !== args.rootPath) {
      const relative = path.relative(args.rootPath, current)
      const normalizedName = relative.split(path.sep).join("/")
      found.set(current, {
        name: normalizedName,
        path: current,
        source: args.source,
        hasSkillFile,
        skillFilePath: path.join(current, skillFileEntry?.name ?? "SKILL.md"),
      })
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      queue.push(path.join(current, entry.name))
    }
  }

  return Array.from(found.values()).sort((first, second) =>
    first.name.localeCompare(second.name, "en")
  )
}

export async function resolveCodexSkillsForWorkspace(
  workspacePath: string
): Promise<CodexSkillsResult> {
  const globalSkillsRoot = getGlobalSkillsRoot()
  const projectSkillsRoot = getProjectSkillsRoot(workspacePath)
  const [globalExists, projectExists] = await Promise.all([
    pathExists(globalSkillsRoot),
    pathExists(projectSkillsRoot),
  ])

  const [globalSkills, projectSkills] = await Promise.all([
    scanSkillDirectories({
      rootPath: globalSkillsRoot,
      source: "global",
    }),
    scanSkillDirectories({
      rootPath: projectSkillsRoot,
      source: "project",
    }),
  ])

  return {
    globalSkillsRoot: toConfigFileInfo(globalSkillsRoot, globalExists),
    projectSkillsRoot: toConfigFileInfo(projectSkillsRoot, projectExists),
    skills: [...globalSkills, ...projectSkills],
  }
}

function resolveSkillsRootBySource(args: {
  source: CodexConfigSource
  workspacePath: string
}) {
  return args.source === "global"
    ? getGlobalSkillsRoot()
    : getProjectSkillsRoot(args.workspacePath)
}

function normalizeSkillName(rawName: string) {
  return rawName
    .trim()
    .split("/")
    .filter(Boolean)
    .join("/")
}

function toUnixPath(value: string) {
  return value.split(path.sep).join("/")
}

function normalizeRelativePath(rawPath: string) {
  return toUnixPath(rawPath.trim()).replace(/^\/+/, "")
}

function isMarkdownPath(filePath: string) {
  const lowered = filePath.toLowerCase()
  return lowered.endsWith(".md") || lowered.endsWith(".mdx")
}

async function listFilesUnderDirectory(args: {
  rootPath: string
  maxFiles?: number
}) {
  const maxFiles =
    typeof args.maxFiles === "number" && Number.isFinite(args.maxFiles)
      ? Math.max(1, Math.trunc(args.maxFiles))
      : 200
  const exists = await pathExists(args.rootPath)
  if (!exists) {
    return []
  }

  const output: CodexSkillFile[] = []
  const queue: string[] = [args.rootPath]

  while (queue.length > 0 && output.length < maxFiles) {
    const current = queue.pop()
    if (!current) {
      continue
    }

    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    const sorted = entries.sort((first, second) =>
      first.name.localeCompare(second.name, "en")
    )
    for (const entry of sorted) {
      const nextPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(nextPath)
        continue
      }
      if (!entry.isFile()) {
        continue
      }

      const relativePath = toUnixPath(path.relative(args.rootPath, nextPath))
      output.push({
        relativePath,
        absolutePath: nextPath,
        isMarkdown: isMarkdownPath(relativePath),
      })
      if (output.length >= maxFiles) {
        break
      }
    }
  }

  return output.sort((first, second) =>
    first.relativePath.localeCompare(second.relativePath, "en")
  )
}

async function resolveSkillFilePath(skillDirectoryPath: string) {
  const direct = path.join(skillDirectoryPath, "SKILL.md")
  if (await pathExists(direct)) {
    return direct
  }

  const directLower = path.join(skillDirectoryPath, "skill.md")
  if (await pathExists(directLower)) {
    return directLower
  }

  let entries
  try {
    entries = await readdir(skillDirectoryPath, { withFileTypes: true })
  } catch {
    return null
  }

  const match = entries.find(
    (entry) => entry.isFile() && entry.name.toLowerCase() === "skill.md"
  )
  if (!match) {
    return null
  }

  return path.join(skillDirectoryPath, match.name)
}

export async function getCodexSkillPreviewForWorkspace(args: {
  workspacePath: string
  source: CodexConfigSource
  skillName: string
  selectedFilePath?: string | null
}): Promise<CodexSkillPreview | null> {
  const rootPath = resolveSkillsRootBySource({
    source: args.source,
    workspacePath: args.workspacePath,
  })
  const rootExists = await pathExists(rootPath)
  if (!rootExists) {
    return null
  }

  const normalizedSkillName = normalizeSkillName(args.skillName)
  if (!normalizedSkillName) {
    return null
  }

  const skillDirectoryPath = path.resolve(rootPath, normalizedSkillName)
  if (!isInsideRoot(rootPath, skillDirectoryPath)) {
    return null
  }

  const skillFilePath = await resolveSkillFilePath(skillDirectoryPath)
  if (!skillFilePath) {
    return null
  }

  const files = await listFilesUnderDirectory({
    rootPath: skillDirectoryPath,
    maxFiles: 400,
  })

  const normalizedSelectedFilePath = normalizeRelativePath(
    args.selectedFilePath ?? ""
  )
  const skillFileRelativePath = toUnixPath(
    path.relative(skillDirectoryPath, skillFilePath)
  )
  const fallbackRelativePath = files.some(
    (file) => file.relativePath === skillFileRelativePath
  )
    ? skillFileRelativePath
    : files[0]?.relativePath

  const targetRelativePath =
    normalizedSelectedFilePath &&
    files.some((file) => file.relativePath === normalizedSelectedFilePath)
      ? normalizedSelectedFilePath
      : fallbackRelativePath

  const selectedFileMeta = targetRelativePath
    ? files.find((file) => file.relativePath === targetRelativePath) ?? null
    : null

  let selectedFile: CodexSkillPreview["selectedFile"] = null
  if (selectedFileMeta) {
    const selectedStats = await stat(selectedFileMeta.absolutePath).catch(() => null)
    if (selectedStats?.isFile() && selectedStats.size <= 2 * 1024 * 1024) {
      const selectedBuffer = await readFile(selectedFileMeta.absolutePath).catch(
        () => null
      )
      if (selectedBuffer && !selectedBuffer.includes(0)) {
        selectedFile = {
          relativePath: selectedFileMeta.relativePath,
          absolutePath: selectedFileMeta.absolutePath,
          content: selectedBuffer.toString("utf8"),
          isMarkdown: selectedFileMeta.isMarkdown,
        }
      }
    }
  }

  const references = files
    .filter((file) => file.relativePath.startsWith("references/"))
    .map((file) => file.relativePath.slice("references/".length))
  const scripts = files
    .filter((file) => file.relativePath.startsWith("scripts/"))
    .map((file) => file.relativePath.slice("scripts/".length))
  const assets = files
    .filter((file) => file.relativePath.startsWith("assets/"))
    .map((file) => file.relativePath.slice("assets/".length))

  return {
    skill: {
      name: normalizedSkillName,
      path: skillDirectoryPath,
      source: args.source,
      hasSkillFile: true,
      skillFilePath,
    },
    files,
    selectedFile,
    supportFiles: {
      references,
      scripts,
      assets,
    },
  }
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

export async function setProjectMcpServerEnabled(args: {
  workspacePath: string
  serverName: string
  enabled: boolean
}) {
  await setMcpServerEnabled({
    scope: "project",
    workspacePath: args.workspacePath,
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
    workspacePath: null,
    serverName: args.serverName,
    enabled: args.enabled,
  })
}

async function setMcpServerEnabled(args: {
  scope: CodexConfigSource
  workspacePath: string | null
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
      : getProjectCodexConfigPath(args.workspacePath ?? "")
  const configDir = path.dirname(configPath)
  await mkdir(configDir, { recursive: true })

  const existingContent = (await readFile(configPath, "utf8").catch(() => "")).replace(
    /\r\n/g,
    "\n"
  )
  const nextContent = setMcpServerEnabledInToml({
    content: existingContent,
    serverName,
    enabled: args.enabled,
  })

  await writeFile(configPath, `${nextContent}\n`, "utf8")
}
