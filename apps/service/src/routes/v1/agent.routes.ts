import type { FastifyInstance } from "fastify"

import { getAgentCapabilities } from "../../lib/agents"

const getAgentCapabilitiesRouteSchema = {
  tags: ["agents"],
  operationId: "getAgentCapabilities",
  security: [{ cookieAuth: [] }],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["ok", "capabilities"],
      properties: {
        ok: { type: "boolean", const: true },
        capabilities: {
          type: "object",
          additionalProperties: false,
          required: ["checkedAt", "agents"],
          properties: {
            checkedAt: { type: "string", format: "date-time" },
            agents: {
              type: "object",
              additionalProperties: false,
              required: ["codex", "claude-code"],
              properties: {
                codex: {
                  $ref: "agentCapabilitiesSchema#",
                },
                "claude-code": {
                  $ref: "agentCapabilitiesSchema#",
                },
              },
            },
          },
        },
      },
    },
  },
} as const

const agentCapabilitiesSchema = {
  $id: "agentCapabilitiesSchema",
  type: "object",
  additionalProperties: false,
  required: ["models", "supportsResume", "supportsStreaming"],
  properties: {
    models: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "isDefault", "efforts"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          isDefault: { type: "boolean" },
          efforts: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    supportsResume: { type: "boolean" },
    supportsStreaming: { type: "boolean" },
  },
} as const

export async function registerAgentRoutes(app: FastifyInstance) {
  app.addSchema(agentCapabilitiesSchema)

  app.get(
    "/agents/capabilities",
    {
      schema: getAgentCapabilitiesRouteSchema,
    },
    async () => {
      const capabilities = await getAgentCapabilities()

      return {
        ok: true,
        capabilities,
      }
    },
  )
}
