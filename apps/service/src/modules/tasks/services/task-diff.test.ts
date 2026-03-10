import { describe, expect, it } from "vitest"

import { parseUnifiedDiff } from "./task-diff"

describe("parseUnifiedDiff", () => {
  it("parses text patch hunks with line numbers", () => {
    const files = parseUnifiedDiff(`
diff --git a/src/example.ts b/src/example.ts
index 1111111..2222222 100644
--- a/src/example.ts
+++ b/src/example.ts
@@ -1,3 +1,4 @@
 export const value = 1
-console.log(value)
+console.log("next", value)
+console.log("done")
 export default value
`.trim())

    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({
      path: "src/example.ts",
      oldPath: "src/example.ts",
      status: "modified",
      additions: 2,
      deletions: 1,
    })
    expect(files[0]?.hunks[0]?.lines).toEqual([
      {
        type: "context",
        content: "export const value = 1",
        oldLineNumber: 1,
        newLineNumber: 1,
      },
      {
        type: "delete",
        content: 'console.log(value)',
        oldLineNumber: 2,
        newLineNumber: null,
      },
      {
        type: "add",
        content: 'console.log("next", value)',
        oldLineNumber: null,
        newLineNumber: 2,
      },
      {
        type: "add",
        content: 'console.log("done")',
        oldLineNumber: null,
        newLineNumber: 3,
      },
      {
        type: "context",
        content: "export default value",
        oldLineNumber: 3,
        newLineNumber: 4,
      },
    ])
  })

  it("parses renamed and binary files", () => {
    const files = parseUnifiedDiff(`
diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 100%
rename from src/old-name.ts
rename to src/new-name.ts
diff --git a/assets/logo.png b/assets/logo.png
new file mode 100644
Binary files /dev/null and b/assets/logo.png differ
`.trim())

    expect(files).toHaveLength(2)
    expect(files[0]).toMatchObject({
      path: "src/new-name.ts",
      oldPath: "src/old-name.ts",
      status: "renamed",
    })
    expect(files[1]).toMatchObject({
      path: "assets/logo.png",
      oldPath: null,
      status: "added",
      isBinary: true,
    })
  })
})
