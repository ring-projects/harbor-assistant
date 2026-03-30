import { describe, expect, it } from "vitest"

import { cn, parseNullablePositiveInteger } from "./utils"

describe("cn", () => {
  it("merges class names and resolves tailwind conflicts", () => {
    expect(cn("px-2", "px-4", "font-medium", undefined, false)).toBe(
      "px-4 font-medium",
    )
  })
})

describe("parseNullablePositiveInteger", () => {
  it("parses positive integers from form strings", () => {
    expect(parseNullablePositiveInteger("14")).toBe(14)
    expect(parseNullablePositiveInteger(" 7 ")).toBe(7)
  })

  it("returns null for empty or invalid values", () => {
    expect(parseNullablePositiveInteger("")).toBeNull()
    expect(parseNullablePositiveInteger("0")).toBeNull()
    expect(parseNullablePositiveInteger("-1")).toBeNull()
    expect(parseNullablePositiveInteger("1.5")).toBeNull()
    expect(parseNullablePositiveInteger("abc")).toBeNull()
  })
})
