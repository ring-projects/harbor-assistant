import cors from "@fastify/cors"
import Fastify, { type FastifyInstance } from "fastify"

import type { ServiceConfig } from "./config"
import apiDocsPlugin from "./plugins/api-docs"
import errorHandlerPlugin from "./plugins/error-handler"
import prismaPlugin from "./plugins/prisma"
import { registerV1Routes } from "./routes/v1"
import { getServiceBuildInfo } from "./version"

const SERVICE_CORS_METHODS = ["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"]

const healthzRouteSchema = {
  tags: ["service"],
  operationId: "getServiceHealth",
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: [
        "ok",
        "service",
        "version",
        "gitSha",
        "buildTime",
        "timestamp",
      ],
      properties: {
        ok: { type: "boolean", const: true },
        service: { type: "string", minLength: 1 },
        version: { type: "string", minLength: 1 },
        gitSha: { type: ["string", "null"] },
        buildTime: { type: ["string", "null"], format: "date-time" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  },
} as const

const versionRouteSchema = {
  tags: ["service"],
  operationId: "getServiceVersion",
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "service", "version", "gitSha", "buildTime"],
      properties: {
        ok: { type: "boolean", const: true },
        service: { type: "string", minLength: 1 },
        version: { type: "string", minLength: 1 },
        gitSha: { type: ["string", "null"] },
        buildTime: { type: ["string", "null"], format: "date-time" },
      },
    },
  },
} as const

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
  await app.register(apiDocsPlugin, { config })
  await app.register(errorHandlerPlugin)
  await app.register(prismaPlugin, {
    datasourceUrl: config.database,
    log: config.isProduction ? ["error"] : ["error", "warn", "info"],
  })

  app.get(
    "/healthz",
    {
      schema: healthzRouteSchema,
    },
    async () => {
      return {
        ok: true,
        service: config.serviceName,
        version: buildInfo.version,
        gitSha: buildInfo.gitSha,
        buildTime: buildInfo.buildTime,
        timestamp: new Date().toISOString(),
      }
    },
  )

  app.get(
    "/version",
    {
      schema: versionRouteSchema,
    },
    async () => {
      return {
        ok: true,
        service: config.serviceName,
        version: buildInfo.version,
        gitSha: buildInfo.gitSha,
        buildTime: buildInfo.buildTime,
      }
    },
  )

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
