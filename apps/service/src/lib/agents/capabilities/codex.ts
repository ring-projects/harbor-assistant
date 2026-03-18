import { existsSync, readFileSync, realpathSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"

import type { AgentCapabilities, AgentModel } from "../types"
import { resolveCommandVersion } from "../utils/command"
import { CODEX_CONFIG_PATH } from "../constants"
import { buildChildProcessEnv } from "../../process-env"

const PLATFORM_VERSION_SUFFIX_BY_TARGET: Record<string, string> = {
  "x86_64-unknown-linux-musl": "linux-x64",
  "aarch64-unknown-linux-musl": "linux-arm64",
  "x86_64-apple-darwin": "darwin-x64",
  "aarch64-apple-darwin": "darwin-arm64",
  "x86_64-pc-windows-msvc": "win32-x64",
  "aarch64-pc-windows-msvc": "win32-arm64",
}

type BundledCodexRuntime = {
  command: string
  version: string | null
}

function resolveTargetTriple(platform: NodeJS.Platform, arch: string) {
  switch (platform) {
    case "linux":
    case "android":
      if (arch === "x64") {
        return "x86_64-unknown-linux-musl"
      }

      if (arch === "arm64") {
        return "aarch64-unknown-linux-musl"
      }
      return null

    case "darwin":
      if (arch === "x64") {
        return "x86_64-apple-darwin"
      }

      if (arch === "arm64") {
        return "aarch64-apple-darwin"
      }
      return null

    case "win32":
      if (arch === "x64") {
        return "x86_64-pc-windows-msvc"
      }

      if (arch === "arm64") {
        return "aarch64-pc-windows-msvc"
      }
      return null

    default:
      return null
  }
}

function readPackageVersion(packageJsonPath: string): string | null {
  try {
    const packageJson = JSON.parse(
      readFileSync(packageJsonPath, "utf8"),
    ) as {
      version?: unknown
    }

    return typeof packageJson.version === "string"
      ? `codex-cli ${packageJson.version}`
      : null
  } catch {
    return null
  }
}

export function buildCodexChildEnv(overrides?: Record<string, string>) {
  const env = buildChildProcessEnv(overrides)
  env.NO_COLOR = "1"
  return env
}

export function resolveBundledCodexRuntime(): BundledCodexRuntime | null {
  try {
    const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
    const sdkPackageJsonPath = findNearestSdkPackageJson(moduleDirectory)

    if (!sdkPackageJsonPath) {
      return null
    }

    const resolvedSdkPackageJsonPath = realpathSync(sdkPackageJsonPath)
    const pnpmRoot = findNearestPnpmRoot(path.dirname(resolvedSdkPackageJsonPath))

    if (!pnpmRoot) {
      return null
    }

    const sdkPackageJson = JSON.parse(
      readFileSync(resolvedSdkPackageJsonPath, "utf8"),
    ) as {
      dependencies?: Record<string, string>
    }
    const codexVersion = sdkPackageJson.dependencies?.["@openai/codex"]?.trim()

    if (!codexVersion) {
      return null
    }

    const codexPackageJsonPath = path.join(
      pnpmRoot,
      `@openai+codex@${codexVersion}`,
      "node_modules",
      "@openai",
      "codex",
      "package.json",
    )

    if (!existsSync(codexPackageJsonPath)) {
      return null
    }

    const version = readPackageVersion(codexPackageJsonPath)
    const targetTriple = resolveTargetTriple(process.platform, process.arch)

    if (!targetTriple) {
      return null
    }

    const platformVersionSuffix = PLATFORM_VERSION_SUFFIX_BY_TARGET[targetTriple]
    if (!platformVersionSuffix) {
      return null
    }

    const platformPackageJsonPath = path.join(
      pnpmRoot,
      `@openai+codex@${codexVersion}-${platformVersionSuffix}`,
      "node_modules",
      "@openai",
      "codex",
      "package.json",
    )

    if (!existsSync(platformPackageJsonPath)) {
      return null
    }

    const vendorRoot = path.join(path.dirname(platformPackageJsonPath), "vendor")
    const binaryName = process.platform === "win32" ? "codex.exe" : "codex"
    const command = path.join(vendorRoot, targetTriple, "codex", binaryName)

    if (!existsSync(command)) {
      return null
    }

    return {
      command,
      version,
    }
  } catch {
    return null
  }
}

function findNearestSdkPackageJson(startDirectory: string) {
  let currentDirectory = startDirectory

  while (true) {
    const candidate = path.join(
      currentDirectory,
      "node_modules",
      "@openai",
      "codex-sdk",
      "package.json",
    )

    if (existsSync(candidate)) {
      return candidate
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      return null
    }

    currentDirectory = parentDirectory
  }
}

function findNearestPnpmRoot(startDirectory: string) {
  let currentDirectory = startDirectory

  while (true) {
    if (path.basename(currentDirectory) === ".pnpm") {
      return currentDirectory
    }

    const parentDirectory = path.dirname(currentDirectory)
    if (parentDirectory === currentDirectory) {
      return null
    }

    currentDirectory = parentDirectory
  }
}

/**
 * Extract default model from config file
 */
function extractDefaultModelFromConfig(configContent: string): string | null {
  const match = configContent.match(/^\s*model\s*=\s*["']([^"']+)["']/m)
  return match?.[1]?.trim() || null
}

/**
 * Resolve models from config file
 */
async function resolveModelsFromConfig(): Promise<AgentModel[] | null> {
  try {
    const configPath = path.join(homedir(), CODEX_CONFIG_PATH)
    const content = await readFile(configPath, "utf8")
    const model = extractDefaultModelFromConfig(content)

    if (!model) {
      return null
    }

    return [
      {
        id: model,
        displayName: model,
        isDefault: true,
      },
    ]
  } catch {
    return null
  }
}

/**
 * Normalize model data
 */
function normalizeModelItems(data: unknown): AgentModel[] {
  if (!Array.isArray(data)) {
    return []
  }

  const items: AgentModel[] = []
  const seen = new Set<string>()

  for (const rawItem of data) {
    if (typeof rawItem !== "object" || rawItem === null) {
      continue
    }

    const id =
      "model" in rawItem && typeof rawItem.model === "string"
        ? rawItem.model
        : "id" in rawItem && typeof rawItem.id === "string"
          ? rawItem.id
          : null

    if (!id || seen.has(id)) {
      continue
    }

    seen.add(id)
    items.push({
      id,
      displayName:
        "displayName" in rawItem && typeof rawItem.displayName === "string"
          ? rawItem.displayName
          : id,
      isDefault: "isDefault" in rawItem && rawItem.isDefault === true,
    })
  }

  return items
}

/**
 * Resolve models via app-server
 */
async function resolveModelsViaAppServer(
  codexCommand: string,
): Promise<AgentModel[]> {
  return new Promise((resolve) => {
    const child = spawn(codexCommand, ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: buildCodexChildEnv(),
    })

    const stdout = child.stdout
    if (!stdout) {
      resolve([])
      return
    }

    const readline = createInterface({
      input: stdout,
      crlfDelay: Infinity,
    })

    let settled = false
    let requestId = 1
    let pendingModelRequestId: number | null = null
    const collectedItems: AgentModel[] = []

    function stopProcess() {
      readline.close()
      child.kill("SIGTERM")
    }

    function settleWith(items: AgentModel[]) {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      stopProcess()
      resolve(items)
    }

    function sendJsonRpc(message: unknown) {
      child.stdin.write(`${JSON.stringify(message)}\n`)
    }

    function requestModelPage(cursor?: string) {
      requestId += 1
      pendingModelRequestId = requestId
      sendJsonRpc({
        id: requestId,
        method: "model/list",
        params: {
          limit: 100,
          includeHidden: false,
          cursor: cursor ?? null,
        },
      })
    }

    const timeout = setTimeout(() => {
      settleWith([])
    }, 4_000)

    child.on("error", () => {
      settleWith([])
    })

    child.on("close", () => {
      if (!settled) {
        settleWith([])
      }
    })

    readline.on("line", (line) => {
      let message: unknown
      try {
        message = JSON.parse(line)
      } catch {
        return
      }

      if (typeof message !== "object" || message === null) {
        return
      }

      const typedMessage = message as {
        id?: unknown
        result?: unknown
        error?: unknown
      }

      if (typedMessage.id === 1) {
        if (typedMessage.error) {
          settleWith([])
          return
        }

        sendJsonRpc({
          method: "initialized",
          params: {},
        })
        requestModelPage()
        return
      }

      if (typedMessage.id !== pendingModelRequestId) {
        return
      }

      if (typedMessage.error) {
        settleWith([])
        return
      }

      if (
        typeof typedMessage.result !== "object" ||
        typedMessage.result === null
      ) {
        settleWith([])
        return
      }

      const typedResult = typedMessage.result as {
        data?: unknown
        nextCursor?: unknown
      }

      collectedItems.push(...normalizeModelItems(typedResult.data))
      const nextCursor =
        typeof typedResult.nextCursor === "string" &&
        typedResult.nextCursor.length > 0
          ? typedResult.nextCursor
          : null

      if (nextCursor) {
        requestModelPage(nextCursor)
        return
      }

      settleWith(normalizeModelItems(collectedItems))
    })

    sendJsonRpc({
      id: 1,
      method: "initialize",
      params: {
        clientInfo: {
          name: "harbor-assistant",
          title: "Harbor Assistant",
          version: "0.1.0",
        },
        capabilities: {
          experimentalApi: true,
          optOutNotificationMethods: [],
        },
      },
    })
  })
}

/**
 * Resolve Codex model list
 */
async function resolveCodexModels(codexCommand: string): Promise<AgentModel[]> {
  const appServerModels = await resolveModelsViaAppServer(codexCommand)
  if (appServerModels.length > 0) {
    return appServerModels
  }

  const configModels = await resolveModelsFromConfig()
  if (configModels) {
    return configModels
  }

  return []
}

/**
 * Inspect Codex agent capabilities
 */
export async function inspectCodexCapabilities(): Promise<AgentCapabilities> {
  const bundledRuntime = resolveBundledCodexRuntime()

  if (!bundledRuntime) {
    return {
      installed: false,
      version: null,
      models: [],
      supportsResume: false,
      supportsStreaming: false,
    }
  }

  return {
    installed: true,
    version:
      bundledRuntime.version ??
      await resolveCommandVersion(bundledRuntime.command),
    models: await resolveCodexModels(bundledRuntime.command),
    supportsResume: true,
    supportsStreaming: true,
  }
}
