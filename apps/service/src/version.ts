import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const servicePackage = require("../package.json") as {
  version?: string
}

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim()
  return value ? value : null
}

export type ServiceBuildInfo = {
  version: string
  gitSha: string | null
  buildTime: string | null
}

export function getServiceBuildInfo(): ServiceBuildInfo {
  return {
    version:
      readOptionalEnv("APP_VERSION") ?? servicePackage.version ?? "0.0.0",
    gitSha: readOptionalEnv("GIT_SHA"),
    buildTime: readOptionalEnv("BUILD_TIME"),
  }
}
