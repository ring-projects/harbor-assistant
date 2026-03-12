import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { parse, stringify } from "yaml"

function getErrorCode(error) {
  return typeof error === "object" &&
    error &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : null
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function toAbsolutePath(value, options = {}) {
  const homeDirectory = options.homeDirectory ?? homedir()
  const baseDirectory = options.baseDirectory ?? process.cwd()

  if (value === "~") {
    return homeDirectory
  }

  if (value.startsWith("~/")) {
    return path.join(homeDirectory, value.slice(2))
  }

  return path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(baseDirectory, value)
}

function toIntegerOrDefault(value, fallback) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isInteger(parsed)) {
      return parsed
    }
  }

  return fallback
}

function toStringOrDefault(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function toSqliteDatabaseUrl(filePath) {
  return `file:${filePath}`
}

export function getHarborPaths(env = process.env) {
  const homeDirectory = env.HARBOR_HOME?.trim()
    ? toAbsolutePath(env.HARBOR_HOME.trim())
    : path.join(homedir(), ".harbor")
  const configPath = env.HARBOR_CONFIG_PATH?.trim()
    ? toAbsolutePath(env.HARBOR_CONFIG_PATH.trim())
    : path.join(homeDirectory, "app.yaml")

  return {
    homeDirectory,
    dataDirectory: path.join(homeDirectory, "data"),
    configPath,
  }
}

export const DEFAULT_APP_CONFIG = {
  service: {
    host: "127.0.0.1",
    port: 3400,
    name: "harbor",
  },
  fileBrowser: {
    rootDirectory: "~",
  },
  project: {
    dataFile: "data/projects.sqlite",
  },
  task: {
    dataFile: "data/tasks.json",
    databaseFile: "data/harbor.sqlite",
  },
}

export const DEFAULT_APP_CONFIG_CONTENT = stringify(DEFAULT_APP_CONFIG)

async function checkConfigFileExists(configPath) {
  try {
    await access(configPath)
    return true
  } catch (error) {
    if (getErrorCode(error) === "ENOENT") {
      return false
    }

    throw error
  }
}

export async function initializeHarborConfiguration(options = {}) {
  const paths = getHarborPaths(options.env)
  const exists = await checkConfigFileExists(paths.configPath)
  if (exists) {
    return {
      created: false,
      ...paths,
    }
  }

  await mkdir(path.dirname(paths.configPath), { recursive: true })
  await mkdir(paths.dataDirectory, { recursive: true })
  await writeFile(paths.configPath, DEFAULT_APP_CONFIG_CONTENT, "utf8")

  return {
    created: true,
    ...paths,
  }
}

export async function resolveHarborConfig(options = {}) {
  const initialized = await initializeHarborConfiguration(options)
  const paths = getHarborPaths(options.env)
  const raw = await readFile(paths.configPath, "utf8")
  const parsed = parse(raw) ?? {}

  if (!isRecord(parsed)) {
    throw new Error(`Invalid Harbor config at ${paths.configPath}: expected object root.`)
  }

  const service = isRecord(parsed.service) ? parsed.service : {}
  const fileBrowser = isRecord(parsed.fileBrowser) ? parsed.fileBrowser : {}
  const project = isRecord(parsed.project) ? parsed.project : {}
  const task = isRecord(parsed.task) ? parsed.task : {}
  const configDirectory = path.dirname(paths.configPath)

  const resolved = {
    ...paths,
    createdDefaultConfig: initialized.created,
    service: {
      host: toStringOrDefault(service.host, DEFAULT_APP_CONFIG.service.host),
      port: toIntegerOrDefault(service.port, DEFAULT_APP_CONFIG.service.port),
      name: toStringOrDefault(service.name, DEFAULT_APP_CONFIG.service.name),
    },
    fileBrowser: {
      rootDirectory: toAbsolutePath(
        toStringOrDefault(
          fileBrowser.rootDirectory,
          DEFAULT_APP_CONFIG.fileBrowser.rootDirectory,
        ),
        {
          baseDirectory: configDirectory,
        },
      ),
    },
    project: {
      dataFile: toAbsolutePath(
        toStringOrDefault(project.dataFile, DEFAULT_APP_CONFIG.project.dataFile),
        {
          baseDirectory: configDirectory,
        },
      ),
    },
    task: {
      dataFile: toAbsolutePath(
        toStringOrDefault(task.dataFile, DEFAULT_APP_CONFIG.task.dataFile),
        {
          baseDirectory: configDirectory,
        },
      ),
      databaseFile: toAbsolutePath(
        toStringOrDefault(
          task.databaseFile,
          DEFAULT_APP_CONFIG.task.databaseFile,
        ),
        {
          baseDirectory: configDirectory,
        },
      ),
    },
  }

  await mkdir(path.dirname(resolved.project.dataFile), { recursive: true })
  await mkdir(path.dirname(resolved.task.dataFile), { recursive: true })
  await mkdir(path.dirname(resolved.task.databaseFile), { recursive: true })

  return {
    ...resolved,
    databaseUrl: toSqliteDatabaseUrl(resolved.task.databaseFile),
  }
}
