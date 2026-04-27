import { describe, expect, it } from "vitest"

import {
  classifyGitCommandFailure,
  parseBranchList,
  parseCurrentBranch,
  parseStatusDirty,
  parseUnifiedDiff,
} from "./git-output"

describe("git output helpers", () => {
  it("parses branch names and marks current branch", () => {
    expect(
      parseBranchList(
        "main\nfeature/refactor\nrelease/1.0\n",
        "feature/refactor",
      ),
    ).toEqual([
      { name: "main", current: false },
      { name: "feature/refactor", current: true },
      { name: "release/1.0", current: false },
    ])
  })

  it("parses current branch and detached head output", () => {
    expect(parseCurrentBranch("main\n")).toBe("main")
    expect(parseCurrentBranch("\n")).toBeNull()
  })

  it("parses dirty state from git status --porcelain --branch output", () => {
    expect(parseStatusDirty("## main...origin/main\n")).toBe(false)
    expect(parseStatusDirty("## main...origin/main\n M src/index.ts\n")).toBe(
      true,
    )
  })

  it("classifies repository not found and git not available failures", () => {
    expect(
      classifyGitCommandFailure({
        stdout: "",
        stderr:
          "fatal: not a git repository (or any of the parent directories): .git",
        exitCode: 128,
      }),
    ).toBe("repository-not-found")

    expect(
      classifyGitCommandFailure({
        stdout: "",
        stderr: "spawn git ENOENT",
        exitCode: null,
      }),
    ).toBe("git-not-available")
  })

  it("parses unified diff hunks with line numbers", () => {
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

    expect(parseUnifiedDiff(patch)).toEqual([
      {
        path: "src/example.ts",
        oldPath: "src/example.ts",
        status: "modified",
        isBinary: false,
        additions: 2,
        deletions: 1,
        isTooLarge: false,
        patch,
        hunks: [
          {
            header: "@@ -1,2 +1,3 @@",
            lines: [
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
            ],
          },
        ],
      },
    ])
  })
})
