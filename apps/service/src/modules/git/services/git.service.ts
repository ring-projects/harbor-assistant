import type { ProjectRepository } from "../../project"
import { createGitError } from "../errors"
import type { GitBranchList, GitDiff, GitRepositorySummary } from "../types"
import type { GitCommandResult, GitRepository } from "../repositories"
import { readProjectGitDiff } from "./git-diff.service"

export type GetGitRepositorySummaryInput = {
  projectId: string
}

export type ListGitBranchesInput = {
  projectId: string
}

export type CheckoutGitBranchInput = {
  projectId: string
  branchName: string
}

export type CreateGitBranchInput = {
  projectId: string
  branchName: string
  checkout?: boolean
  fromRef?: string | null
}

export type GetGitDiffInput = {
  projectId: string
}

function normalizeStderr(result: GitCommandResult) {
  return result.stderr.trim() || result.stdout.trim()
}

function isGitUnavailable(result: GitCommandResult) {
  return (
    result.exitCode === null &&
    /spawn git enoent|git: command not found|enoent/i.test(
      `${result.stderr}\n${result.stdout}`,
    )
  )
}

function isNotGitRepository(result: GitCommandResult) {
  return /not a git repository/i.test(normalizeStderr(result))
}

function isDirtyCheckoutConflict(result: GitCommandResult) {
  return /please commit your changes or stash them|would be overwritten by checkout/i.test(
    normalizeStderr(result),
  )
}

function isMissingBranch(result: GitCommandResult) {
  return /pathspec .* did not match any file|invalid reference|not a valid object name|unknown revision/i.test(
    normalizeStderr(result),
  )
}

function isBranchAlreadyExists(result: GitCommandResult) {
  return /already exists/i.test(normalizeStderr(result))
}

function sanitizeBranchName(branchName: string) {
  return branchName.trim()
}

function hasObviousInvalidBranchPattern(branchName: string) {
  return (
    branchName.length === 0 ||
    branchName.startsWith("/") ||
    branchName.endsWith("/") ||
    branchName.includes("..") ||
    branchName.includes("@{") ||
    /[\u0000-\u001f\u007f ~^:?*\\[\]]/.test(branchName)
  )
}

function parseCurrentBranch(stdout: string) {
  const value = stdout.trim()
  return value.length > 0 ? value : null
}

function parseDirty(stdout: string) {
  const lines = stdout.split(/\r?\n/).slice(1)
  return lines.some((line) => line.trim().length > 0)
}

function parseBranchList(stdout: string, currentBranch: string | null) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      current: name === currentBranch,
    }))
}

export function createGitService(args: {
  projectRepository: Pick<ProjectRepository, "getProjectById">
  gitRepository: GitRepository
}) {
  const { projectRepository, gitRepository } = args

  async function getProjectPath(projectId: string) {
    const normalizedProjectId = projectId.trim()
    if (!normalizedProjectId) {
      throw createGitError.invalidProjectId()
    }

    const project = await projectRepository.getProjectById(normalizedProjectId)
    if (!project) {
      throw createGitError.projectNotFound(normalizedProjectId)
    }

    return project.path
  }

  async function ensureRepository(projectPath: string) {
    const result = await gitRepository.getRepositoryRoot(projectPath)
    if (result.exitCode === 0) {
      return result.stdout.trim()
    }

    if (isGitUnavailable(result)) {
      throw createGitError.gitNotAvailable(normalizeStderr(result))
    }

    if (isNotGitRepository(result)) {
      throw createGitError.repositoryNotFound(projectPath)
    }

    throw createGitError.readFailed(
      `Failed to resolve git repository root for ${projectPath}: ${normalizeStderr(result)}`,
    )
  }

  async function validateBranchName(projectPath: string, branchName: string) {
    const normalizedBranchName = sanitizeBranchName(branchName)

    if (hasObviousInvalidBranchPattern(normalizedBranchName)) {
      throw createGitError.invalidBranchName(undefined, {
        branchName,
      })
    }

    const result = await gitRepository.validateBranchName(
      normalizedBranchName,
      projectPath,
    )
    if (result.exitCode !== 0) {
      throw createGitError.invalidBranchName(normalizeStderr(result), {
        branchName,
      })
    }

    return normalizedBranchName
  }

  async function readCurrentBranch(projectPath: string) {
    const currentBranchResult = await gitRepository.getCurrentBranch(projectPath)
    if (currentBranchResult.exitCode !== 0) {
      if (isGitUnavailable(currentBranchResult)) {
        throw createGitError.gitNotAvailable(normalizeStderr(currentBranchResult))
      }

      throw createGitError.readFailed(
        `Failed to read current git branch: ${normalizeStderr(currentBranchResult)}`,
      )
    }

    return parseCurrentBranch(currentBranchResult.stdout)
  }

  async function getRepositorySummary(
    input: GetGitRepositorySummaryInput,
  ): Promise<GitRepositorySummary> {
    const projectPath = await getProjectPath(input.projectId)
    const repositoryRoot = await ensureRepository(projectPath)
    const currentBranch = await readCurrentBranch(projectPath)
    const statusResult = await gitRepository.getStatus(projectPath)

    if (statusResult.exitCode !== 0) {
      if (isGitUnavailable(statusResult)) {
        throw createGitError.gitNotAvailable(normalizeStderr(statusResult))
      }

      throw createGitError.readFailed(
        `Failed to read git status: ${normalizeStderr(statusResult)}`,
      )
    }

    return {
      projectId: input.projectId.trim(),
      repositoryRoot,
      currentBranch,
      detached: currentBranch === null,
      dirty: parseDirty(statusResult.stdout),
    }
  }

  async function listBranches(input: ListGitBranchesInput): Promise<GitBranchList> {
    const projectPath = await getProjectPath(input.projectId)
    await ensureRepository(projectPath)
    const currentBranch = await readCurrentBranch(projectPath)
    const branchResult = await gitRepository.listBranches(projectPath)

    if (branchResult.exitCode !== 0) {
      if (isGitUnavailable(branchResult)) {
        throw createGitError.gitNotAvailable(normalizeStderr(branchResult))
      }

      throw createGitError.readFailed(
        `Failed to list git branches: ${normalizeStderr(branchResult)}`,
      )
    }

    return {
      projectId: input.projectId.trim(),
      currentBranch,
      branches: parseBranchList(branchResult.stdout, currentBranch),
    }
  }

  async function getDiff(input: GetGitDiffInput): Promise<GitDiff> {
    const projectPath = await getProjectPath(input.projectId)
    await ensureRepository(projectPath)

    try {
      return await readProjectGitDiff({
        projectId: input.projectId.trim(),
        projectPath,
      })
    } catch (error) {
      throw createGitError.readFailed(
        `Failed to read git diff: ${String(error)}`,
        error,
      )
    }
  }

  async function checkoutBranch(
    input: CheckoutGitBranchInput,
  ): Promise<GitRepositorySummary> {
    const projectPath = await getProjectPath(input.projectId)
    await ensureRepository(projectPath)
    const branchName = await validateBranchName(projectPath, input.branchName)
    const hasBranchResult = await gitRepository.hasBranch(projectPath, branchName)
    if (hasBranchResult.exitCode !== 0) {
      throw createGitError.branchNotFound(branchName)
    }

    const result = await gitRepository.checkoutBranch(projectPath, branchName)

    if (result.exitCode !== 0) {
      if (isGitUnavailable(result)) {
        throw createGitError.gitNotAvailable(normalizeStderr(result))
      }

      if (isMissingBranch(result)) {
        throw createGitError.branchNotFound(branchName)
      }

      if (isDirtyCheckoutConflict(result)) {
        throw createGitError.worktreeDirty(normalizeStderr(result), {
          branchName,
        })
      }

      throw createGitError.checkoutFailed(normalizeStderr(result))
    }

    return getRepositorySummary({
      projectId: input.projectId,
    })
  }

  async function createBranch(
    input: CreateGitBranchInput,
  ): Promise<GitRepositorySummary> {
    const projectPath = await getProjectPath(input.projectId)
    await ensureRepository(projectPath)
    const branchName = await validateBranchName(projectPath, input.branchName)
    const hasBranchResult = await gitRepository.hasBranch(projectPath, branchName)
    if (hasBranchResult.exitCode === 0) {
      throw createGitError.branchAlreadyExists(branchName)
    }

    const result = await gitRepository.createBranch(projectPath, {
      branchName,
      checkout: input.checkout,
      fromRef: input.fromRef,
    })

    if (result.exitCode !== 0) {
      if (isGitUnavailable(result)) {
        throw createGitError.gitNotAvailable(normalizeStderr(result))
      }

      if (isBranchAlreadyExists(result)) {
        throw createGitError.branchAlreadyExists(branchName)
      }

      if (isMissingBranch(result)) {
        throw createGitError.branchNotFound(input.fromRef?.trim() || branchName)
      }

      if (isDirtyCheckoutConflict(result)) {
        throw createGitError.worktreeDirty(normalizeStderr(result), {
          branchName,
        })
      }

      throw createGitError.createBranchFailed(normalizeStderr(result))
    }

    return getRepositorySummary({
      projectId: input.projectId,
    })
  }

  return {
    getRepositorySummary,
    listBranches,
    getDiff,
    checkoutBranch,
    createBranch,
  }
}

export type GitService = ReturnType<typeof createGitService>
