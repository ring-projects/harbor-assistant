import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { createInterface } from "node:readline"

import {
  CODEX_COMMAND_CANDIDATES,
} from "../../../constants/executors"
import { CODEX_CONFIG_RELATIVE_PATH } from "../../../constants/codex"
import {
  findInstalledCommand,
  resolveCommandVersion,
} from "../shared/command"
import type {
  ExecutorCapability,
  ExecutorModelItem,
  ExecutorModelsCapability,
} from "../types"

function extractCodexDefaultModelFromConfig(configContent: string) {
  const match = configContent.match(/^\s*model\s*=\s*["']([^"']+)["']/m)
  return match?.[1]?.trim() || null
}

async function resolveCodexModelsFromConfig() {
  try {
    const configPath = path.join(homedir(), CODEX_CONFIG_RELATIVE_PATH)
    const content = await readFile(configPath, "utf8")
    const model = extractCodexDefaultModelFromConfig(content)
    if (!model) {
      return null
    }

    return {
      status: "ok",
      source: "config",
      items: [
        {
          model,
          displayName: model,
          isDefault: true,
        },
      ],
    } satisfies ExecutorModelsCapability
  } catch {
    return null
  }
}

function normalizeCodexModelItems(data: unknown) {
  if (!Array.isArray(data)) {
    return []
  }

  const items: ExecutorModelItem[] = []
  const seen = new Set<string>()

  for (const rawItem of data) {
    if (typeof rawItem !== "object" || rawItem === null) {
      continue
    }

    const model =
      "model" in rawItem && typeof rawItem.model === "string"
        ? rawItem.model
        : "id" in rawItem && typeof rawItem.id === "string"
          ? rawItem.id
          : null

    if (!model || seen.has(model)) {
      continue
    }

    seen.add(model)
    items.push({
      model,
      displayName:
        "displayName" in rawItem && typeof rawItem.displayName === "string"
          ? rawItem.displayName
          : model,
      isDefault: "isDefault" in rawItem && rawItem.isDefault === true,
    })
  }

  return items
}

async function resolveCodexModelsViaAppServer(
  codexCommand: string,
): Promise<ExecutorModelsCapability> {
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
      resolve({
        status: "error",
        source: "app-server",
        items: [],
        error: "Codex app-server stdout stream is unavailable.",
      })
      return
    }

    const readline = createInterface({
      input: stdout,
      crlfDelay: Infinity,
    })

    let settled = false
    let requestId = 1
    let pendingModelRequestId: number | null = null
    const collectedItems: ExecutorModelItem[] = []
    let lastStderrOutput = ""

    function pushStderr(chunk: Buffer | string) {
      const next = String(chunk).trim()
      if (!next) {
        return
      }

      lastStderrOutput = `${lastStderrOutput}\n${next}`.trim().slice(-2_000)
    }

    child.stderr?.on("data", pushStderr)

    function stopProcess() {
      readline.close()
      child.kill("SIGTERM")
    }

    function settleWith(payload: ExecutorModelsCapability) {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeout)
      stopProcess()
      resolve(payload)
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
      settleWith({
        status: "error",
        source: "app-server",
        items: [],
        error: "Codex model list request timed out.",
      })
    }, 4_000)

    child.on("error", (error) => {
      settleWith({
        status: "error",
        source: "app-server",
        items: [],
        error: `Failed to start codex app-server: ${String(error)}`,
      })
    })

    child.on("close", (code) => {
      if (settled) {
        return
      }

      settleWith({
        status: "error",
        source: "app-server",
        items: [],
        error:
          `Codex app-server exited before returning models (code=${String(code)}).` +
          (lastStderrOutput ? ` ${lastStderrOutput}` : ""),
      })
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
          settleWith({
            status: "error",
            source: "app-server",
            items: [],
            error: "Codex app-server initialization failed.",
          })
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
        settleWith({
          status: "error",
          source: "app-server",
          items: [],
          error: "Codex app-server model/list failed.",
        })
        return
      }

      if (
        typeof typedMessage.result !== "object" ||
        typedMessage.result === null
      ) {
        settleWith({
          status: "error",
          source: "app-server",
          items: [],
          error: "Codex app-server returned an invalid model/list payload.",
        })
        return
      }

      const typedResult = typedMessage.result as {
        data?: unknown
        nextCursor?: unknown
      }

      collectedItems.push(...normalizeCodexModelItems(typedResult.data))
      const nextCursor =
        typeof typedResult.nextCursor === "string" &&
        typedResult.nextCursor.length > 0
          ? typedResult.nextCursor
          : null

      if (nextCursor) {
        requestModelPage(nextCursor)
        return
      }

      settleWith({
        status: "ok",
        source: "app-server",
        items: normalizeCodexModelItems(collectedItems),
      })
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

async function resolveCodexModels(codexCommand: string) {
  const appServerModels = await resolveCodexModelsViaAppServer(codexCommand)
  if (appServerModels.status === "ok" && appServerModels.items.length > 0) {
    return appServerModels
  }

  const configModels = await resolveCodexModelsFromConfig()
  if (configModels) {
    return configModels
  }

  return appServerModels
}

export async function inspectCodexExecutor(): Promise<ExecutorCapability> {
  const command = await findInstalledCommand(CODEX_COMMAND_CANDIDATES)
  if (!command) {
    return {
      installed: false,
      version: null,
      models: {
        status: "not_installed",
        source: null,
        items: [],
        error: "Codex is not installed.",
      },
    }
  }

  return {
    installed: true,
    version: await resolveCommandVersion(command),
    models: await resolveCodexModels(command),
  }
}
