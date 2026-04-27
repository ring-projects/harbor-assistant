import { parseStatusDirty } from "../domain/git-output"
import { createGitError } from "../errors"
import type { GitRepositorySummary } from "../types"
import type { GitRepository } from "./git-repository"
import {
  ensureRepository,
  normalizePathInput,
  readCurrentBranch,
} from "./shared"

export async function getRepositorySummaryUseCase(
  repository: GitRepository,
  input: { path: string },
): Promise<GitRepositorySummary> {
  const path = normalizePathInput(input.path)
  const repositoryRoot = await ensureRepository(repository, path)
  const currentBranch = await readCurrentBranch(repository, path)
  const status = await repository.getStatus(path)

  if (status.exitCode !== 0) {
    throw createGitError().readFailed(
      `Failed to read git status for ${path}: ${status.stderr || status.stdout}`,
    )
  }

  return {
    path,
    repositoryRoot,
    currentBranch,
    detached: currentBranch === null,
    dirty: parseStatusDirty(status.stdout),
  }
}
