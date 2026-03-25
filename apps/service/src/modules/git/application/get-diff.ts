import { parseUnifiedDiff } from "../domain/git-output"
import { createGitError } from "../errors"
import type { GitDiff } from "../types"
import type { GitRepository } from "./git-repository"
import { ensureRepository, normalizePathInput } from "./shared"

export async function getDiffUseCase(
  repository: GitRepository,
  input: { path: string },
): Promise<GitDiff> {
  const path = normalizePathInput(input.path)
  await ensureRepository(repository, path)
  const result = await repository.getDiff(path)

  if (result.exitCode !== 0) {
    throw createGitError().readFailed(
      `Failed to read git diff for ${path}: ${result.stderr || result.stdout}`,
    )
  }

  return {
    path,
    files: parseUnifiedDiff(result.stdout),
  }
}
