import { describe, expect, it } from "vitest"

import { extractAgentCapabilities } from "./agent-payload"

describe("agent-payload", () => {
  it("normalizes agent capabilities from protocol payloads", () => {
    const capabilities = extractAgentCapabilities({
      checkedAt: "2026-03-18T10:00:00.000Z",
      agents: {
        codex: {
          models: [
            {
              id: "gpt-5-codex",
              name: "GPT-5 Codex",
              isDefault: true,
              efforts: ["low", "medium", "high"],
            },
          ],
          supportsResume: true,
          supportsStreaming: true,
        },
        "claude-code": {
          models: [
            {
              id: "claude-sonnet",
              efforts: ["minimal", "low"],
            },
          ],
          supportsResume: false,
          supportsStreaming: true,
        },
      },
    })

    expect(capabilities).toEqual({
      checkedAt: "2026-03-18T10:00:00.000Z",
      agents: {
        codex: {
          models: [
            {
              id: "gpt-5-codex",
              displayName: "GPT-5 Codex",
              isDefault: true,
              efforts: ["low", "medium", "high"],
            },
          ],
          supportsResume: true,
          supportsStreaming: true,
        },
        "claude-code": {
          models: [
            {
              id: "claude-sonnet",
              displayName: "claude-sonnet",
              isDefault: false,
              efforts: ["minimal", "low"],
            },
          ],
          supportsResume: false,
          supportsStreaming: true,
        },
      },
    })
  })
})
