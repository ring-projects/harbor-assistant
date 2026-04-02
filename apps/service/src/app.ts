import cors from "@fastify/cors"
import Fastify, { type FastifyInstance } from "fastify"

import type { ServiceConfig } from "./config"
import { ensureHarborPublicSkills } from "./lib/public-skills"
import errorHandlerPlugin from "./plugins/error-handler"
import prismaPlugin from "./plugins/prisma"
import { registerV1Routes } from "./routes/v1"
import { getServiceBuildInfo } from "./version"

const SERVICE_CORS_METHODS = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"]

export async function buildServiceApp(
  config: ServiceConfig,
): Promise<FastifyInstance> {
  const buildInfo = getServiceBuildInfo()
  const redact = {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['set-cookie']",
    ],
    remove: true,
  }

  const logger = config.isProduction
    ? {
        level: "info",
        redact,
      }
    : {
        level: "debug",
        redact,
      }

  const app = Fastify({
    logger,
  })

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: SERVICE_CORS_METHODS,
  })
  await app.register(errorHandlerPlugin)
  await app.register(prismaPlugin, {
    datasourceUrl: config.database,
    log: config.isProduction ? ["error"] : ["error", "warn", "info"],
  })

  await ensureHarborPublicSkills({
    publicSkillsRootDirectory: config.publicSkillsRootDirectory,
  })

  app.get("/healthz", async () => {
    return {
      ok: true,
      service: config.serviceName,
      version: buildInfo.version,
      gitSha: buildInfo.gitSha,
      buildTime: buildInfo.buildTime,
      timestamp: new Date().toISOString(),
    }
  })

  app.get("/version", async () => {
    return {
      ok: true,
      service: config.serviceName,
      version: buildInfo.version,
      gitSha: buildInfo.gitSha,
      buildTime: buildInfo.buildTime,
    }
  })

  await app.register(
    async (instance) => {
      await registerV1Routes(instance, config)
    },
    {
      prefix: "/v1",
    },
  )

  return app
}
