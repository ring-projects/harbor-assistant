import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import YAML from "yaml"
import { z } from "zod"

import {
  HARBOR_APP_CONFIG_PATH,
  HARBOR_PROJECT_DATA_FILE,
  HARBOR_TASK_DATABASE_FILE,
  HARBOR_TASK_DATA_FILE,
} from "@/utils/harbor-paths"

const APP_CONFIG_PATH = HARBOR_APP_CONFIG_PATH

const AppConfigSchema = z
  .object({
    fileBrowser: z
      .object({
        rootDirectory: z.string().min(1).optional(),
      })
      .optional(),
    project: z
      .object({
        dataFile: z.string().min(1).optional(),
      })
      .optional(),
    task: z
      .object({
        dataFile: z.string().min(1).optional(),
        databaseFile: z.string().min(1).optional(),
      })
      .optional(),
  })
  .optional()

export type AppConfig = {
  fileBrowser: {
    rootDirectory: string
  }
  project: {
    dataFile: string
  }
  task: {
    dataFile: string
    databaseFile: string
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
      rootDirectory: homedir(),
    },
    project: {
      dataFile: HARBOR_PROJECT_DATA_FILE,
    },
    task: {
      dataFile: HARBOR_TASK_DATA_FILE,
      databaseFile: HARBOR_TASK_DATABASE_FILE,
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
    project: {
      dataFile: validated?.project?.dataFile
        ? toAbsolutePath(validated.project.dataFile)
        : defaults.project.dataFile,
    },
    task: {
      dataFile: validated?.task?.dataFile
        ? toAbsolutePath(validated.task.dataFile)
        : defaults.task.dataFile,
      databaseFile: validated?.task?.databaseFile
        ? toAbsolutePath(validated.task.databaseFile)
        : defaults.task.databaseFile,
    },
  }

  return cachedConfig
}
