import cors from "@fastify/cors"
import Fastify, { type FastifyInstance } from "fastify"

import type { ServiceConfig } from "./config"
import prismaPlugin from "./plugins/prisma"
import { registerV1Routes } from "./routes/v1"

export async function buildServiceApp(
  config: ServiceConfig,
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.isProduction ? "info" : "debug",
    },
  })

  await app.register(cors, {
    origin: true,
  })
  await app.register(prismaPlugin)

  app.get("/healthz", async () => {
    return {
      ok: true,
      service: config.serviceName,
      timestamp: new Date().toISOString()
    }
  })

  await app.register(
    async (instance) => {
      await registerV1Routes(instance)
    },
    {
      prefix: "/v1",
    },
  )

  app.setNotFoundHandler(async (_request, reply) => {
    return reply.status(404).send({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    })
  })

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error)

    return reply.status(500).send({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected service error.",
      },
    })
  })

  return app
}
