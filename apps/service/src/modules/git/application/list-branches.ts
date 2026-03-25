import { parseBranchList } from "../domain/git-output"
import { createGitError } from "../errors"
import type { GitBranchList } from "../types"
import type { GitRepository } from "./git-repository"
import { ensureRepository, normalizePathInput, readCurrentBranch } from "./shared"

export async function listBranchesUseCase(
  repository: GitRepository,
  input: { path: string },
): Promise<GitBranchList> {
  const path = normalizePathInput(input.path)
  await ensureRepository(repository, path)
  const currentBranch = await readCurrentBranch(repository, path)
  const result = await repository.listBranches(path)

  if (result.exitCode !== 0) {
    throw createGitError().readFailed(
      `Failed to list git branches for ${path}: ${result.stderr || result.stdout}`,
    )
  }

  return {
    path,
    currentBranch,
    branches: parseBranchList(result.stdout, currentBranch),
  }
}
