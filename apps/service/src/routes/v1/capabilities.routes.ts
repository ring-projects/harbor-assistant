import type { FastifyInstance } from "fastify"

import { ERROR_CODES } from "../../constants/errors"
import { getExecutorCapabilities } from "../../modules/capability/capability.service"

export async function registerCapabilitiesRoutes(app: FastifyInstance) {
  app.get("/executors/capabilities", async (_request, reply) => {
    try {
      const result = await getExecutorCapabilities()
      return reply.send({
        ok: true,
        ...result,
      })
    } catch {
      return reply.status(500).send({
        ok: false,
        error: {
          code: ERROR_CODES.CAPABILITY_CHECK_FAILED,
          message: "Failed to check executor capabilities.",
        },
      })
    }
  })
}
