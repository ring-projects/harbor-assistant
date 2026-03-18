import { describe, expect, it } from "vitest"

import {
  inspectCodexCapabilities,
  resolveBundledCodexRuntime,
} from "./codex"

describe("Codex capability detection", () => {
  it("resolves the SDK-bundled Codex runtime", () => {
    const runtime = resolveBundledCodexRuntime()

    expect(runtime).not.toBeNull()
    expect(runtime?.command).toContain("node_modules")
    expect(runtime?.command).not.toBe("/opt/homebrew/bin/codex")
    expect(runtime?.version).toMatch(/^codex-cli \d+\.\d+\.\d+/)
  })

  it("reports the bundled runtime version", async () => {
    const runtime = resolveBundledCodexRuntime()
    const capabilities = await inspectCodexCapabilities()

    expect(runtime).not.toBeNull()
    expect(capabilities.installed).toBe(true)
    expect(capabilities.supportsResume).toBe(true)
    expect(capabilities.supportsStreaming).toBe(true)
    expect(capabilities.version).toBe(runtime?.version)
  })
})
