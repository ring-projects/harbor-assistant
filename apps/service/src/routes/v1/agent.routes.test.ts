import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import Fastify, { type FastifyInstance } from "fastify"

const { inspectAllAgentCapabilities } = vi.hoisted(() => ({
  inspectAllAgentCapabilities: vi.fn(async () => ({
    checkedAt: new Date("2026-03-18T01:02:03.000Z"),
    availableAgents: ["codex"],
    agents: {
      codex: {
        installed: true,
        version: "codex-cli 0.64.0",
        models: [
          {
            id: "gpt-5",
            displayName: "GPT-5",
            isDefault: true,
          },
        ],
        supportsResume: true,
        supportsStreaming: true,
      },
      "claude-code": {
        installed: false,
        version: null,
        models: [],
        supportsResume: false,
        supportsStreaming: false,
      },
    },
  })),
}))

vi.mock("../../lib/agents", () => ({
  inspectAllAgentCapabilities,
}))

import { registerAgentRoutes } from "./agent.routes"

describe("agent routes", () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await registerAgentRoutes(app)
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it("returns normalized agent capabilities", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/agents/capabilities",
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      ok: true,
      capabilities: {
        checkedAt: "2026-03-18T01:02:03.000Z",
        availableAgents: ["codex"],
        agents: {
          codex: {
            installed: true,
            version: "codex-cli 0.64.0",
            models: [
              {
                id: "gpt-5",
                displayName: "GPT-5",
                isDefault: true,
              },
            ],
            supportsResume: true,
            supportsStreaming: true,
          },
          "claude-code": {
            installed: false,
            version: null,
            models: [],
            supportsResume: false,
            supportsStreaming: false,
          },
        },
      },
    })
  })
})
