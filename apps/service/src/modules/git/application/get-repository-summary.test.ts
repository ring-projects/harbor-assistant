import { describe, expect, it } from "vitest"

import { getRepositorySummaryUseCase } from "./get-repository-summary"
import { GIT_ERROR_CODES, GitError } from "../errors"
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
      stdout: "## main...origin/main\n M src/index.ts\n",
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

describe("getRepositorySummaryUseCase", () => {
  it("returns path-based repository summary for a valid repository", async () => {
    const repository = createGitRepositoryStub()

    await expect(
      getRepositorySummaryUseCase(repository, { path: "/tmp/example" }),
    ).resolves.toEqual({
      path: "/tmp/example",
      repositoryRoot: "/tmp/example",
      currentBranch: "main",
      detached: false,
      dirty: true,
    })
  })

  it("maps non repository paths to structured git error", async () => {
    const repository = createGitRepositoryStub({
      getRepositoryRoot: async () => ({
        stdout: "",
        stderr:
          "fatal: not a git repository (or any of the parent directories): .git",
        exitCode: 128,
      }),
    })

    await expect(
      getRepositorySummaryUseCase(repository, { path: "/tmp/not-a-repo" }),
    ).rejects.toMatchObject({
      code: GIT_ERROR_CODES.REPOSITORY_NOT_FOUND,
    } satisfies Partial<GitError>)
  })

  it("maps git unavailability to structured git error", async () => {
    const repository = createGitRepositoryStub({
      getRepositoryRoot: async () => ({
        stdout: "",
        stderr: "spawn git ENOENT",
        exitCode: null,
      }),
    })

    await expect(
      getRepositorySummaryUseCase(repository, { path: "/tmp/example" }),
    ).rejects.toMatchObject({
      code: GIT_ERROR_CODES.NOT_AVAILABLE,
    } satisfies Partial<GitError>)
  })
})
