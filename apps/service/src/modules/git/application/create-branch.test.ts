import { describe, expect, it } from "vitest"

import { createBranchUseCase } from "./create-branch"
import { GIT_ERROR_CODES, GitError } from "../errors"
import type { GitRepository } from "./git-repository"

function createGitRepositoryStub(
  overrides: Partial<GitRepository> = {},
): GitRepository {
  let currentBranch = "main"
  let branches = ["main"]

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
      stdout: `${branches.join("\n")}\n`,
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
    createBranch: async (_path, input) => {
      branches = [...branches, input.branchName]
      if (input.checkout) {
        currentBranch = input.branchName
      }

      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
      }
    },
    ...overrides,
  }
}

describe("createBranchUseCase", () => {
  it("creates branch and returns updated branch list", async () => {
    const repository = createGitRepositoryStub()

    await expect(
      createBranchUseCase(repository, {
        path: "/tmp/example",
        branchName: "feature/refactor",
        checkout: true,
      }),
    ).resolves.toEqual({
      path: "/tmp/example",
      currentBranch: "feature/refactor",
      branches: [
        { name: "main", current: false },
        { name: "feature/refactor", current: true },
      ],
    })
  })

  it("maps existing branch to structured git error", async () => {
    const repository = createGitRepositoryStub({
      createBranch: async () => ({
        stdout: "",
        stderr: "fatal: a branch named 'main' already exists",
        exitCode: 128,
      }),
    })

    await expect(
      createBranchUseCase(repository, {
        path: "/tmp/example",
        branchName: "main",
      }),
    ).rejects.toMatchObject({
      code: GIT_ERROR_CODES.BRANCH_ALREADY_EXISTS,
    } satisfies Partial<GitError>)
  })
})
