export type HarborPaths = {
  homeDirectory: string
  dataDirectory: string
  configPath: string
}

export type HarborResolvedConfig = HarborPaths & {
  createdDefaultConfig: boolean
  service: {
    host: string
    port: number
    name: string
  }
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
  databaseUrl: string
}

export const DEFAULT_APP_CONFIG: {
  service: {
    host: string
    port: number
    name: string
  }
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

export const DEFAULT_APP_CONFIG_CONTENT: string

export function getHarborPaths(
  env?: NodeJS.ProcessEnv,
): HarborPaths

export function initializeHarborConfiguration(options?: {
  env?: NodeJS.ProcessEnv
}): Promise<HarborPaths & { created: boolean }>

export function resolveHarborConfig(options?: {
  env?: NodeJS.ProcessEnv
}): Promise<HarborResolvedConfig>

