import { describe, expect, it } from "vitest"

import { checkoutBranchUseCase } from "./checkout-branch"
import { GIT_ERROR_CODES, GitError } from "../errors"
import type { GitRepository } from "./git-repository"

function createGitRepositoryStub(
  overrides: Partial<GitRepository> = {},
): GitRepository {
  let currentBranch = "main"

  return {
    getRepositoryRoot: async () => ({
      stdout: "/tmp/example\n",
      stderr: "",
      exitCode: 0,
    }),
    getCurrentBranch: async () => ({
      stdout: `${currentBranch}\n`,
      stderr: "",
      exitCode: 0,
    }),
    getStatus: async () => ({
      stdout: `## ${currentBranch}\n`,
      stderr: "",
      exitCode: 0,
    }),
    listBranches: async () => ({
      stdout: "main\nfeature/refactor\n",
      stderr: "",
      exitCode: 0,
    }),
    getDiff: async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }),
    checkoutBranch: async (_path, branchName) => {
      currentBranch = branchName
      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
      }
    },
    createBranch: async () => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }),
    ...overrides,
  }
}

describe("checkoutBranchUseCase", () => {
  it("switches branch and returns updated repository summary", async () => {
    const repository = createGitRepositoryStub()

    await expect(
      checkoutBranchUseCase(repository, {
        path: "/tmp/example",
        branchName: "feature/refactor",
      }),
    ).resolves.toEqual({
      path: "/tmp/example",
      repositoryRoot: "/tmp/example",
      currentBranch: "feature/refactor",
      detached: false,
      dirty: false,
    })
  })

  it("maps missing branch to structured git error", async () => {
    const repository = createGitRepositoryStub({
      checkoutBranch: async () => ({
        stdout: "",
        stderr:
          "error: pathspec 'missing-branch' did not match any file(s) known to git",
        exitCode: 1,
      }),
    })

    await expect(
      checkoutBranchUseCase(repository, {
        path: "/tmp/example",
        branchName: "missing-branch",
      }),
    ).rejects.toMatchObject({
      code: GIT_ERROR_CODES.BRANCH_NOT_FOUND,
    } satisfies Partial<GitError>)
  })

  it("maps dirty worktree conflict to structured git error", async () => {
    const repository = createGitRepositoryStub({
      checkoutBranch: async () => ({
        stdout: "",
        stderr:
          "error: Your local changes to the following files would be overwritten by checkout:\nREADME.md",
        exitCode: 1,
      }),
    })

    await expect(
      checkoutBranchUseCase(repository, {
        path: "/tmp/example",
        branchName: "feature/refactor",
      }),
    ).rejects.toMatchObject({
      code: GIT_ERROR_CODES.WORKTREE_DIRTY,
    } satisfies Partial<GitError>)
  })
})
