import type { FastifyInstance } from "fastify"
import { z } from "zod"

import { ERROR_CODES } from "../../constants/errors"
import {
  setGlobalMcpServerEnabled,
  setProjectMcpServerEnabled,
} from "../../modules/codex-config/config.service"
import { getProjectById } from "../../modules/project/project.repository"

const SetMcpServerEnabledSchema = z.object({
  projectId: z.string().optional(),
  serverName: z.string(),
  scope: z.enum(["global", "project"]),
  enabled: z.boolean(),
})

export async function registerMcpRoutes(app: FastifyInstance) {
  app.post("/mcp/servers/enabled", async (request, reply) => {
    const parsed = SetMcpServerEnabledSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: ERROR_CODES.INVALID_REQUEST_BODY,
          message:
            "Expected payload: { projectId?: string; serverName: string; scope: 'global' | 'project'; enabled: boolean }.",
        },
      })
    }

    const payload = parsed.data

    if (payload.scope === "global") {
      try {
        await setGlobalMcpServerEnabled({
          serverName: payload.serverName,
          enabled: payload.enabled,
        })

        return reply.send({
          ok: true,
        })
      } catch (error) {
        return reply.status(500).send({
          ok: false,
          error: {
            code: ERROR_CODES.INTERNAL_ERROR,
            message: `Failed to update global MCP server: ${String(error)}`,
          },
        })
      }
    }

    const projectId = payload.projectId?.trim() ?? ""
    if (!projectId) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: ERROR_CODES.INVALID_PROJECT_ID,
          message: "Project id is required when scope=project.",
        },
      })
    }

    try {
      const project = await getProjectById(projectId)
      if (!project) {
        return reply.status(404).send({
          ok: false,
          error: {
            code: ERROR_CODES.PROJECT_NOT_FOUND,
            message: `Project not found: ${projectId}`,
          },
        })
      }

      await setProjectMcpServerEnabled({
        projectPath: project.path,
        serverName: payload.serverName,
        enabled: payload.enabled,
      })

      return reply.send({
        ok: true,
      })
    } catch (error) {
      return reply.status(500).send({
        ok: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `Failed to update project MCP server: ${String(error)}`,
        },
      })
    }
  })
}
