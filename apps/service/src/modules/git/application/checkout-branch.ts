import { classifyGitCommandFailure } from "../domain/git-output"
import { createGitError } from "../errors"
import type { GitRepositorySummary } from "../types"
import type { GitRepository } from "./git-repository"
import {
  ensureRepository,
  normalizeBranchName,
  normalizePathInput,
} from "./shared"
import { getRepositorySummaryUseCase } from "./get-repository-summary"

function normalizeFailureMessage(stderr: string, stdout: string) {
  return stderr.trim() || stdout.trim() || "Unknown git command failure."
}

export async function checkoutBranchUseCase(
  repository: GitRepository,
  input: {
    path: string
    branchName: string
  },
): Promise<GitRepositorySummary> {
  const path = normalizePathInput(input.path)
  const branchName = normalizeBranchName(input.branchName)

  await ensureRepository(repository, path)
  const result = await repository.checkoutBranch(path, branchName)

  if (result.exitCode !== 0) {
    const failure = classifyGitCommandFailure(result)

    if (failure === "git-not-available") {
      throw createGitError().notAvailable(
        normalizeFailureMessage(result.stderr, result.stdout),
      )
    }

    if (failure === "branch-not-found") {
      throw createGitError().branchNotFound(branchName)
    }

    if (failure === "worktree-dirty") {
      throw createGitError().worktreeDirty(
        normalizeFailureMessage(result.stderr, result.stdout),
      )
    }

    throw createGitError().checkoutFailed(
      `Failed to checkout branch ${branchName}: ${normalizeFailureMessage(
        result.stderr,
        result.stdout,
      )}`,
    )
  }

  return getRepositorySummaryUseCase(repository, { path })
}
