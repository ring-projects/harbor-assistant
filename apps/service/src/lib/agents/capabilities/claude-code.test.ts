import { describe, expect, it } from "vitest"

import {
  CLAUDE_CODE_DECLARED_CAPABILITIES,
  getClaudeCodeCapabilities,
} from "./claude-code"

describe("Claude Code capability detection", () => {
  it("returns the declared capability structure", async () => {
    await expect(getClaudeCodeCapabilities()).resolves.toEqual(
      CLAUDE_CODE_DECLARED_CAPABILITIES,
    )
  })
})
