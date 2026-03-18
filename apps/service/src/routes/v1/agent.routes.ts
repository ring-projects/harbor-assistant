import type { FastifyInstance } from "fastify"

import { inspectAllAgentCapabilities } from "../../lib/agents"

const getAgentCapabilitiesRouteSchema = {
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
          required: ["checkedAt", "availableAgents", "agents"],
          properties: {
            checkedAt: { type: "string", format: "date-time" },
            availableAgents: {
              type: "array",
              items: {
                type: "string",
                enum: ["codex", "claude-code"],
              },
            },
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
  required: [
    "installed",
    "version",
    "models",
    "supportsResume",
    "supportsStreaming",
  ],
  properties: {
    installed: { type: "boolean" },
    version: { type: ["string", "null"] },
    models: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "displayName", "isDefault"],
        properties: {
          id: { type: "string" },
          displayName: { type: "string" },
          isDefault: { type: "boolean" },
        },
      },
    },
    supportsResume: { type: "boolean" },
    supportsStreaming: { type: "boolean" },
  },
} as const

export async function registerAgentRoutes(
  app: FastifyInstance,
  args?: { harborHomeDirectory?: string },
) {
  app.addSchema(agentCapabilitiesSchema)

  app.get(
    "/agents/capabilities",
    {
      schema: getAgentCapabilitiesRouteSchema,
    },
    async () => {
      const capabilities = await inspectAllAgentCapabilities({
        harborHomeDirectory: args?.harborHomeDirectory,
      })

      return {
        ok: true,
        capabilities,
      }
    },
  )
}
