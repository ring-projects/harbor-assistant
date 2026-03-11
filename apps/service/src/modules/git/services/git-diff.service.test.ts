import { describe, expect, it } from "vitest"

import { parseUnifiedDiff } from "./git-diff.service"

describe("parseUnifiedDiff", () => {
  it("parses text patch hunks with line numbers", () => {
    const patch = [
      "diff --git a/src/example.ts b/src/example.ts",
      "index 1111111..2222222 100644",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1,2 +1,3 @@",
      " line one",
      "-line two",
      "+line 2 changed",
      "+line three",
    ].join("\n")

    const files = parseUnifiedDiff(patch)

    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({
      path: "src/example.ts",
      oldPath: "src/example.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
      isBinary: false,
    })
    expect(files[0]?.hunks[0]?.lines).toEqual([
      {
        type: "context",
        content: "line one",
        oldLineNumber: 1,
        newLineNumber: 1,
      },
      {
        type: "delete",
        content: "line two",
        oldLineNumber: 2,
        newLineNumber: null,
      },
      {
        type: "add",
        content: "line 2 changed",
        oldLineNumber: null,
        newLineNumber: 2,
      },
      {
        type: "add",
        content: "line three",
        oldLineNumber: null,
        newLineNumber: 3,
      },
    ])
  })

  it("parses renamed and binary files", () => {
    const patch = [
      "diff --git a/src/old.ts b/src/new.ts",
      "similarity index 88%",
      "rename from src/old.ts",
      "rename to src/new.ts",
      "diff --git a/assets/icon.png b/assets/icon.png",
      "new file mode 100644",
      "Binary files /dev/null and b/assets/icon.png differ",
      "",
    ].join("\n")

    const files = parseUnifiedDiff(patch)

    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({
      path: "src/new.ts",
      oldPath: "src/old.ts",
      status: "renamed",
      isBinary: false,
    })
    expect(files[1]).toMatchObject({
      path: "assets/icon.png",
      oldPath: null,
      status: "added",
      isBinary: true,
    })
  })
})
