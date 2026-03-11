import { describe, expect, it } from "vitest"

import { inferLanguageFromFilePath, normalizeCodeLanguage } from "./utils"

describe("normalizeCodeLanguage", () => {
  it("normalizes common aliases", () => {
    expect(normalizeCodeLanguage(" TypeScriptReact ")).toBe("tsx")
    expect(normalizeCodeLanguage("javascript")).toBe("js")
    expect(normalizeCodeLanguage("yml")).toBe("yaml")
    expect(normalizeCodeLanguage("zsh")).toBe("bash")
  })

  it("returns null for empty values", () => {
    expect(normalizeCodeLanguage("   ")).toBeNull()
    expect(normalizeCodeLanguage(null)).toBeNull()
  })
})

describe("inferLanguageFromFilePath", () => {
  it("infers languages from supported extensions", () => {
    expect(inferLanguageFromFilePath("src/app/page.tsx")).toBe("tsx")
    expect(inferLanguageFromFilePath("README.mdx")).toBe("markdown")
    expect(inferLanguageFromFilePath("scripts/setup.zsh")).toBe("bash")
    expect(inferLanguageFromFilePath("schema.yml")).toBe("yaml")
  })

  it("returns null for unknown or empty file paths", () => {
    expect(inferLanguageFromFilePath("notes.unknown")).toBeNull()
    expect(inferLanguageFromFilePath("   ")).toBeNull()
  })
})
