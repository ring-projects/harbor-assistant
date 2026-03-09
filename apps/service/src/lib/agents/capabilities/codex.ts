import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"

import type { AgentCapabilities, AgentModel } from "../types"
import {
  findInstalledCommand,
  resolveCommandVersion,
} from "../utils/command"
import { AGENT_COMMANDS, CODEX_CONFIG_PATH } from "../constants"

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
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
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
  const command = await findInstalledCommand(AGENT_COMMANDS.codex)

  if (!command) {
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
    version: await resolveCommandVersion(command),
    models: await resolveCodexModels(command),
    supportsResume: true,
    supportsStreaming: true,
  }
}
