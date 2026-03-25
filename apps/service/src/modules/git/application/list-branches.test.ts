import { describe, expect, it } from "vitest"

import { listBranchesUseCase } from "./list-branches"
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
      stdout: "feature/refactor\n",
      stderr: "",
      exitCode: 0,
    }),
    getStatus: async () => ({
      stdout: "## feature/refactor\n",
      stderr: "",
      exitCode: 0,
    }),
    listBranches: async () => ({
      stdout: "main\nfeature/refactor\nrelease/1.0\n",
      stderr: "",
      exitCode: 0,
    }),
    getDiff: async () => ({
      stdout: "",
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

describe("listBranchesUseCase", () => {
  it("returns current branch and branch list for a repository path", async () => {
    const repository = createGitRepositoryStub()

    await expect(
      listBranchesUseCase(repository, { path: "/tmp/example" }),
    ).resolves.toEqual({
      path: "/tmp/example",
      currentBranch: "feature/refactor",
      branches: [
        { name: "main", current: false },
        { name: "feature/refactor", current: true },
        { name: "release/1.0", current: false },
      ],
    })
  })
})
