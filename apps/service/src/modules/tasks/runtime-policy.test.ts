import { describe, expect, it } from "vitest"

import {
  RUNTIME_POLICY_PRESETS,
  inferExecutionMode,
  resolveRuntimePolicy,
} from "./runtime-policy"

describe("runtime policy", () => {
  it("resolves connected preset to the expected policy", () => {
    expect(
      resolveRuntimePolicy({
        executionMode: "connected",
      }),
    ).toEqual({
      executionMode: "connected",
      runtimePolicy: RUNTIME_POLICY_PRESETS.connected,
    })
  })

  it("marks modified preset policies as custom", () => {
    const resolved = resolveRuntimePolicy({
      executionMode: "safe",
      runtimePolicy: {
        networkAccessEnabled: true,
      },
    })

    expect(resolved.runtimePolicy.networkAccessEnabled).toBe(true)
    expect(resolved.executionMode).toBe("custom")
    expect(inferExecutionMode(resolved.runtimePolicy)).toBe("custom")
  })
})
