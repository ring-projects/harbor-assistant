import { describe, expect, it } from "vitest"

import { mergeAgentModelsWithCustomConfig } from "./custom-models"

describe("custom agent models", () => {
  it("adds custom models and promotes the configured default", () => {
    const merged = mergeAgentModelsWithCustomConfig({
      agentType: "codex",
      models: [
        {
          id: "gpt-5",
          displayName: "GPT-5",
          isDefault: true,
        },
      ],
      customConfig: {
        codex: {
          defaultModel: "gpt-5.4",
          models: [
            {
              id: "gpt-5.4",
              displayName: "GPT-5.4",
            },
          ],
        },
      },
    })

    expect(merged).toEqual([
      {
        id: "gpt-5",
        displayName: "GPT-5",
        isDefault: false,
      },
      {
        id: "gpt-5.4",
        displayName: "GPT-5.4",
        isDefault: true,
      },
    ])
  })
})
