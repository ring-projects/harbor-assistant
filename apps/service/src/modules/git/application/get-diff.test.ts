import { describe, expect, it } from "vitest"

import { getDiffUseCase } from "./get-diff"
import type { GitRepository } from "./git-repository"

function createGitRepositoryStub(
  overrides: Partial<GitRepository> = {},
): GitRepository {
  return {
    getRepositoryRoot: async () => ({
      stdout: "/tmp/example\n",
      stderr: "",
      exitCode: 0,
    }),
    getCurrentBranch: async () => ({
      stdout: "main\n",
      stderr: "",
      exitCode: 0,
    }),
    getStatus: async () => ({
      stdout: "## main\n",
      stderr: "",
      exitCode: 0,
    }),
    listBranches: async () => ({
      stdout: "main\n",
      stderr: "",
      exitCode: 0,
    }),
    getDiff: async () => ({
      stdout: [
        "diff --git a/src/example.ts b/src/example.ts",
        "index 1111111..2222222 100644",
        "--- a/src/example.ts",
        "+++ b/src/example.ts",
        "@@ -1 +1 @@",
        "-old line",
        "+new line",
      ].join("\n"),
      stderr: "",
      exitCode: 0,
    }),
    checkoutBranch: async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }),
    createBranch: async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }),
    ...overrides,
  }
}

describe("getDiffUseCase", () => {
  it("returns structured diff for a repository path", async () => {
    const repository = createGitRepositoryStub()

    await expect(
      getDiffUseCase(repository, { path: "/tmp/example" }),
    ).resolves.toMatchObject({
      path: "/tmp/example",
      files: [
        {
          path: "src/example.ts",
          status: "modified",
          additions: 1,
          deletions: 1,
        },
      ],
    })
  })
})
