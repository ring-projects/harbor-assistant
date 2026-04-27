import { describe, expect, it } from "vitest"

import {
  ensurePathInsideRoot,
  normalizeListCursor,
  normalizeListLimit,
  resolveRequestedPath,
} from "./path-policy"

describe("filesystem path policy", () => {
  it("resolves relative paths against the root path", () => {
    expect(resolveRequestedPath("/workspace/root", "src/index.ts")).toBe(
      "/workspace/root/src/index.ts",
    )
  })

  it("keeps absolute paths absolute before boundary checks", () => {
    expect(
      resolveRequestedPath("/workspace/root", "/workspace/root/src/index.ts"),
    ).toBe("/workspace/root/src/index.ts")
  })

  it("rejects paths outside the allowed root", () => {
    expect(() =>
      ensurePathInsideRoot("/workspace/root", "/workspace/other/file.ts"),
    ).toThrow("outside allowed root")
  })

  it("normalizes cursor and limit values", () => {
    expect(normalizeListCursor(undefined)).toBe(0)
    expect(normalizeListCursor("2")).toBe(2)
    expect(normalizeListLimit(undefined, 200, 1000)).toBe(200)
    expect(normalizeListLimit(2000, 200, 1000)).toBe(1000)
  })

  it("rejects invalid cursor values", () => {
    expect(() => normalizeListCursor("-1")).toThrow("cursor")
    expect(() => normalizeListCursor("abc")).toThrow("cursor")
  })
})
