import type { FastifyInstance } from "fastify"

import { ERROR_CODES } from "../../constants/errors"
import { getAgentCapabilities } from "../../modules/capability/capability.service"

export async function registerCapabilitiesRoutes(app: FastifyInstance) {
  app.get("/agents/capabilities", async (_request, reply) => {
    try {
      const result = await getAgentCapabilities()
      return reply.send({
        ok: true,
        ...result,
      })
    } catch {
      return reply.status(500).send({
        ok: false,
        error: {
          code: ERROR_CODES.CAPABILITY_CHECK_FAILED,
          message: "Failed to check agent capabilities.",
        },
      })
    }
  })

  // 保留旧的 API 路径以兼容
  app.get("/executors/capabilities", async (_request, reply) => {
    try {
      const result = await getAgentCapabilities()
      return reply.send({
        ok: true,
        checkedAt: result.checkedAt.toISOString(),
        executors: {
          codex: result.agents.codex,
          opencode: { installed: false, version: null, models: [] },
          claudcode: result.agents["claude-code"],
        },
        availableExecutors: result.availableAgents,
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
