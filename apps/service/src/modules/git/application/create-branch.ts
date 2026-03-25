import { classifyGitCommandFailure } from "../domain/git-output"
import { createGitError } from "../errors"
import type { GitBranchList } from "../types"
import type { GitRepository } from "./git-repository"
import {
  ensureRepository,
  normalizeBranchName,
  normalizePathInput,
} from "./shared"
import { listBranchesUseCase } from "./list-branches"

function normalizeFailureMessage(stderr: string, stdout: string) {
  return stderr.trim() || stdout.trim() || "Unknown git command failure."
}

export async function createBranchUseCase(
  repository: GitRepository,
  input: {
    path: string
    branchName: string
    checkout?: boolean
    fromRef?: string | null
  },
): Promise<GitBranchList> {
  const path = normalizePathInput(input.path)
  const branchName = normalizeBranchName(input.branchName)

  await ensureRepository(repository, path)
  const result = await repository.createBranch(path, {
    branchName,
    checkout: input.checkout,
    fromRef: input.fromRef?.trim() ? input.fromRef.trim() : null,
  })

  if (result.exitCode !== 0) {
    const failure = classifyGitCommandFailure(result)

    if (failure === "git-not-available") {
      throw createGitError().notAvailable(
        normalizeFailureMessage(result.stderr, result.stdout),
      )
    }

    if (failure === "branch-already-exists") {
      throw createGitError().branchAlreadyExists(branchName)
    }

    throw createGitError().createBranchFailed(
      `Failed to create branch ${branchName}: ${normalizeFailureMessage(
        result.stderr,
        result.stdout,
      )}`,
    )
  }

  return listBranchesUseCase(repository, { path })
}
