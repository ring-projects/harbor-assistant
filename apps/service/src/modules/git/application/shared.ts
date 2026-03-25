import { createGitError } from "../errors"
import {
  classifyGitCommandFailure,
  parseCurrentBranch,
} from "../domain/git-output"
import type { GitRepository } from "./git-repository"

function normalizeFailureMessage(stderr: string, stdout: string) {
  return stderr.trim() || stdout.trim() || "Unknown git command failure."
}

export function normalizePathInput(path: string) {
  const normalizedPath = path.trim()
  if (!normalizedPath) {
    throw createGitError().invalidInput("Path is required.")
  }

  return normalizedPath
}

export function normalizeBranchName(branchName: string) {
  const normalizedBranchName = branchName.trim()

  if (
    normalizedBranchName.length === 0 ||
    normalizedBranchName.startsWith("/") ||
    normalizedBranchName.endsWith("/") ||
    normalizedBranchName.includes("..") ||
    normalizedBranchName.includes("@{") ||
    /[\u0000-\u001f\u007f ~^:?*\\[\]]/.test(normalizedBranchName)
  ) {
    throw createGitError().invalidInput("Branch name is invalid.")
  }

  return normalizedBranchName
}

export async function ensureRepository(
  repository: GitRepository,
  path: string,
) {
  const result = await repository.getRepositoryRoot(path)
  if (result.exitCode === 0) {
    return result.stdout.trim()
  }

  const failure = classifyGitCommandFailure(result)
  if (failure === "git-not-available") {
    throw createGitError().notAvailable(
      normalizeFailureMessage(result.stderr, result.stdout),
    )
  }

  if (failure === "repository-not-found") {
    throw createGitError().repositoryNotFound(path)
  }

  throw createGitError().readFailed(
    `Failed to resolve git repository root for ${path}: ${normalizeFailureMessage(
      result.stderr,
      result.stdout,
    )}`,
  )
}

export async function readCurrentBranch(
  repository: GitRepository,
  path: string,
) {
  const result = await repository.getCurrentBranch(path)
  if (result.exitCode === 0) {
    return parseCurrentBranch(result.stdout)
  }

  const failure = classifyGitCommandFailure(result)
  if (failure === "git-not-available") {
    throw createGitError().notAvailable(
      normalizeFailureMessage(result.stderr, result.stdout),
    )
  }

  throw createGitError().readFailed(
    `Failed to read current git branch for ${path}: ${normalizeFailureMessage(
      result.stderr,
      result.stdout,
    )}`,
  )
}
