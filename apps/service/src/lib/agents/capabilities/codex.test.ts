import { describe, expect, it } from "vitest"

import {
  CODEX_DECLARED_CAPABILITIES,
  getCodexCapabilities,
  getCodexDeclaredCapabilities,
} from "./codex"

describe("Codex capability detection", () => {
  it("returns the declared capability structure", () => {
    expect(getCodexDeclaredCapabilities()).toEqual(CODEX_DECLARED_CAPABILITIES)
  })

  it("uses the declared capability structure during inspection", async () => {
    await expect(getCodexCapabilities()).resolves.toEqual(
      CODEX_DECLARED_CAPABILITIES,
    )
  })
})
