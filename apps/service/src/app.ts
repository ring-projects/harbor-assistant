import cors from "@fastify/cors"
import Fastify, { type FastifyInstance } from "fastify"

import type { ServiceConfig } from "./config"
import errorHandlerPlugin from "./plugins/error-handler"
import prismaPlugin from "./plugins/prisma"
import { registerV1Routes } from "./routes/v1"

export async function buildServiceApp(
  config: ServiceConfig,
): Promise<FastifyInstance> {
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
        transport: config.nodeEnv === "development"
          ? {
              target: "pino-pretty",
              options: {
                colorize: true,
                ignore: "pid,hostname",
                translateTime: "SYS:standard",
              },
            }
          : undefined,
        redact,
      }

  const app = Fastify({
    logger,
  })

  await app.register(cors, {
    origin: true,
  })
  await app.register(errorHandlerPlugin)
  await app.register(prismaPlugin, {
    datasourceUrl: config.database,
    log: config.isProduction ? ["error"] : ["error", "warn", "info"],
  })

  app.get("/healthz", async () => {
    return {
      ok: true,
      service: config.serviceName,
      timestamp: new Date().toISOString()
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
