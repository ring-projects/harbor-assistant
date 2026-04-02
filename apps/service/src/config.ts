import { access, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { z } from "zod"

const configSchema = z.object({
  port: z.coerce.number().int().default(3400),
  host: z.string().default("127.0.0.1"),
  serviceName: z.string().default("harbor"),
  database: z.string().min(1),
  fileBrowserRootDirectory: z.string().min(1),
  workspaceRootDirectory: z.string().min(1),
  publicSkillsRootDirectory: z.string().min(1),
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  appBaseUrl: z.url(),
  webBaseUrl: z.url().optional(),
  githubClientId: z.string().min(1).optional(),
  githubClientSecret: z.string().min(1).optional(),
  githubAppSlug: z.string().min(1).optional(),
  githubAppId: z.string().min(1).optional(),
  githubAppPrivateKey: z.string().min(1).optional(),
  githubAppWebhookSecret: z.string().min(1).optional(),
  allowedGitHubUsers: z.array(z.string().min(1)).default([]),
  allowedGitHubOrgs: z.array(z.string().min(1)).default([]),
})

const fileConfigSchema = z.object({
  service: z
    .object({
      host: z.string().min(1).optional(),
      port: z.coerce.number().int().optional(),
      name: z.string().min(1).optional(),
    })
    .optional(),
  paths: z
    .object({
      runtimeRootDirectory: z.string().min(1).optional(),
      fileBrowserRootDirectory: z.string().min(1).optional(),
      workspaceRootDirectory: z.string().min(1).optional(),
      publicSkillsRootDirectory: z.string().min(1).optional(),
    })
    .optional(),
  urls: z
    .object({
      appBaseUrl: z.url().optional(),
      webBaseUrl: z.url().optional(),
    })
    .optional(),
  auth: z
    .object({
      allowedGitHubUsers: z.array(z.string().min(1)).optional(),
      allowedGitHubOrgs: z.array(z.string().min(1)).optional(),
    })
    .optional(),
})

function getServiceRootDirectory() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
}

function resolveAbsolutePath(value: string, baseDirectory: string) {
  return path.isAbsolute(value) ? path.resolve(value) : path.resolve(baseDirectory, value)
}

async function pathExists(pathname: string) {
  try {
    await access(pathname)
    return true
  } catch {
    return false
  }
}

async function loadServiceFileConfig(args: {
  configPath: string
  isExplicitPath: boolean
}) {
  const exists = await pathExists(args.configPath)
  if (!exists) {
    if (args.isExplicitPath) {
      throw new Error(`Missing Harbor service config file: ${args.configPath}`)
    }

    return {}
  }

  const raw = await readFile(args.configPath, "utf8")

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `Invalid Harbor service config at ${args.configPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const validated = fileConfigSchema.safeParse(parsed)
  if (!validated.success) {
    throw new Error(
      `Invalid Harbor service config: ${JSON.stringify(validated.error.flatten())}`,
    )
  }

  return validated.data
}

export async function loadServiceConfig(args?: {
  env?: NodeJS.ProcessEnv
}) {
  const env = args?.env ?? process.env
  const serviceRootDirectory = getServiceRootDirectory()
  const explicitConfigPath = env.HARBOR_CONFIG_PATH?.trim()
  const configPath = explicitConfigPath
    ? resolveAbsolutePath(explicitConfigPath, process.cwd())
    : path.join(serviceRootDirectory, "harbor.config.json")
  const fileConfig = await loadServiceFileConfig({
    configPath,
    isExplicitPath: Boolean(explicitConfigPath),
  })
  const configDirectory = path.dirname(configPath)
  const runtimeRootDirectory = fileConfig.paths?.runtimeRootDirectory
    ? resolveAbsolutePath(fileConfig.paths.runtimeRootDirectory, configDirectory)
    : path.join(serviceRootDirectory, ".harbor")
  const fileBrowserRootDirectory = fileConfig.paths?.fileBrowserRootDirectory
    ? resolveAbsolutePath(fileConfig.paths.fileBrowserRootDirectory, configDirectory)
    : path.resolve(serviceRootDirectory, "../..")
  const workspaceRootDirectory = fileConfig.paths?.workspaceRootDirectory
    ? resolveAbsolutePath(fileConfig.paths.workspaceRootDirectory, configDirectory)
    : path.join(runtimeRootDirectory, "workspaces")
  const publicSkillsRootDirectory = fileConfig.paths?.publicSkillsRootDirectory
    ? resolveAbsolutePath(fileConfig.paths.publicSkillsRootDirectory, configDirectory)
    : path.join(runtimeRootDirectory, "skills", "profiles", "default")
  const parsed = configSchema.safeParse({
    port: fileConfig.service?.port,
    host: fileConfig.service?.host,
    serviceName: fileConfig.service?.name,
    database: env.DATABASE_URL,
    fileBrowserRootDirectory,
    workspaceRootDirectory,
    publicSkillsRootDirectory,
    nodeEnv: env.NODE_ENV,
    appBaseUrl: fileConfig.urls?.appBaseUrl,
    webBaseUrl: fileConfig.urls?.webBaseUrl,
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET,
    githubAppSlug: env.GITHUB_APP_SLUG,
    githubAppId: env.GITHUB_APP_ID,
    githubAppPrivateKey: env.GITHUB_APP_PRIVATE_KEY,
    githubAppWebhookSecret: env.GITHUB_APP_WEBHOOK_SECRET,
    allowedGitHubUsers: fileConfig.auth?.allowedGitHubUsers,
    allowedGitHubOrgs: fileConfig.auth?.allowedGitHubOrgs,
  })

  if (!parsed.success) {
    throw new Error(
      `Invalid Harbor service config: ${JSON.stringify(parsed.error.flatten())}`,
    )
  }

  return {
    ...parsed.data,
    isProduction: parsed.data.nodeEnv === "production",
  }
}

export type ServiceConfig = Awaited<ReturnType<typeof loadServiceConfig>>
