import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import Fastify, { type FastifyInstance } from "fastify"

const { getAgentCapabilities } = vi.hoisted(() => ({
  getAgentCapabilities: vi.fn(async () => ({
    checkedAt: new Date("2026-03-18T01:02:03.000Z"),
    agents: {
      codex: {
        models: [
          {
            id: "gpt-5.3-codex",
            name: "GPT-5.3 Codex",
            isDefault: true,
            efforts: ["low", "medium", "high", "xhigh"],
          },
        ],
        supportsResume: true,
        supportsStreaming: true,
      },
      "claude-code": {
        models: [],
        supportsResume: false,
        supportsStreaming: false,
      },
    },
  })),
}))

vi.mock("../../lib/agents", () => ({
  getAgentCapabilities,
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
        agents: {
          codex: {
            models: [
              {
                id: "gpt-5.3-codex",
                name: "GPT-5.3 Codex",
                isDefault: true,
                efforts: ["low", "medium", "high", "xhigh"],
              },
            ],
            supportsResume: true,
            supportsStreaming: true,
          },
          "claude-code": {
            models: [],
            supportsResume: false,
            supportsStreaming: false,
          },
        },
      },
    })
  })
})
