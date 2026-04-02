import { z } from "zod"

import { resolveHarborConfig } from "../../../scripts/harbor-config.mjs"

const configSchema = z.object({
  port: z.coerce.number().int().default(3400),
  host: z.string().default("127.0.0.1"),
  trustProxy: z.boolean().default(false),
  serviceName: z.string().default("harbor"),
  database: z.url(),
  fileBrowserRootDirectory: z.string().min(1),
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  appBaseUrl: z.url().optional(),
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

function parseCsvEnv(value: string | undefined) {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseBooleanEnv(value: string | undefined) {
  if (!value) {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false
  }

  return undefined
}

export async function loadServiceConfig(args?: {
  env?: NodeJS.ProcessEnv
}) {
  const env = args?.env ?? process.env
  const harbor = await resolveHarborConfig({ env })
  const harborService = harbor.service as typeof harbor.service & {
    trustProxy?: boolean
  }
  const parsed = configSchema.safeParse({
    port: env.PORT ?? harbor.service.port,
    host: env.HOST ?? harbor.service.host,
    trustProxy: parseBooleanEnv(env.TRUST_PROXY) ?? harborService.trustProxy ?? false,
    serviceName: env.SERVICE_NAME ?? harbor.service.name,
    database: env.DATABASE_URL ?? harbor.databaseUrl,
    fileBrowserRootDirectory:
      env.FILE_BROWSER_ROOT_DIRECTORY ?? harbor.fileBrowser.rootDirectory,
    nodeEnv: env.NODE_ENV,
    appBaseUrl: env.APP_BASE_URL,
    webBaseUrl: env.WEB_BASE_URL,
    githubClientId: env.GITHUB_CLIENT_ID,
    githubClientSecret: env.GITHUB_CLIENT_SECRET,
    githubAppSlug: env.GITHUB_APP_SLUG,
    githubAppId: env.GITHUB_APP_ID,
    githubAppPrivateKey: env.GITHUB_APP_PRIVATE_KEY,
    githubAppWebhookSecret: env.GITHUB_APP_WEBHOOK_SECRET,
    allowedGitHubUsers: parseCsvEnv(env.ALLOWED_GITHUB_USERS),
    allowedGitHubOrgs: parseCsvEnv(env.ALLOWED_GITHUB_ORGS),
  })

  if (!parsed.success) {
    throw new Error(
      `Invalid Harbor service config: ${JSON.stringify(parsed.error.flatten())}`,
    )
  }

  return {
    ...parsed.data,
    isProduction: parsed.data.nodeEnv === "production",
    harborConfigPath: harbor.configPath,
    harborHomeDirectory: harbor.homeDirectory,
    taskDatabaseFile: harbor.task.databaseFile,
  }
}

export type ServiceConfig = Awaited<ReturnType<typeof loadServiceConfig>>
