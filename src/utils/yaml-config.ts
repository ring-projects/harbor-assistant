import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import YAML from "yaml"
import { z } from "zod"

const APP_CONFIG_PATH = path.resolve(process.cwd(), "config", "app.yaml")

const AppConfigSchema = z
  .object({
    fileBrowser: z
      .object({
        rootDirectory: z.string().min(1).optional(),
      })
      .optional(),
    workspace: z
      .object({
        dataFile: z.string().min(1).optional(),
      })
      .optional(),
  })
  .optional()

export type AppConfig = {
  fileBrowser: {
    rootDirectory: string
  }
  workspace: {
    dataFile: string
  }
}

function expandHomePath(value: string) {
  if (value === "~") {
    return homedir()
  }

  if (value.startsWith("~/")) {
    return path.join(homedir(), value.slice(2))
  }

  return value
}

function toAbsolutePath(value: string) {
  const expanded = expandHomePath(value.trim())
  return path.isAbsolute(expanded)
    ? path.resolve(expanded)
    : path.resolve(process.cwd(), expanded)
}

function createDefaultConfig(): AppConfig {
  return {
    fileBrowser: {
      rootDirectory: process.cwd(),
    },
    workspace: {
      dataFile: path.join(homedir(), ".otter-assistant", "data", "workspaces.json"),
    },
  }
}

let cachedConfig: AppConfig | null = null

export function getAppConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const defaults = createDefaultConfig()
  if (!existsSync(APP_CONFIG_PATH)) {
    cachedConfig = defaults
    return cachedConfig
  }

  const content = readFileSync(APP_CONFIG_PATH, "utf8")
  const parsed = YAML.parse(content)
  const validated = AppConfigSchema.parse(parsed)

  cachedConfig = {
    fileBrowser: {
      rootDirectory: validated?.fileBrowser?.rootDirectory
        ? toAbsolutePath(validated.fileBrowser.rootDirectory)
        : defaults.fileBrowser.rootDirectory,
    },
    workspace: {
      dataFile: validated?.workspace?.dataFile
        ? toAbsolutePath(validated.workspace.dataFile)
        : defaults.workspace.dataFile,
    },
  }

  return cachedConfig
}
