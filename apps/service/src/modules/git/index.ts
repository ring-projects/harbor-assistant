export type {
  GitBranch,
  GitBranchList,
  GitDiff,
  GitDiffFile,
  GitDiffFileStatus,
  GitDiffHunk,
  GitDiffLine,
  GitDiffLineType,
  GitRepositorySummary,
} from "./types"

export { GitError, createGitError } from "./errors"
export type { GitErrorCode } from "./errors"

export { createGitRepository, runGitCommand } from "./repositories"
export type { GitCommandResult, GitRepository } from "./repositories"

export { createGitService } from "./services"
export { parseUnifiedDiff, readProjectGitDiff } from "./services"
export type {
  CheckoutGitBranchInput,
  CreateGitBranchInput,
  GetGitDiffInput,
  GetGitRepositorySummaryInput,
  GitService,
  ListGitBranchesInput,
} from "./services"

export { registerGitModuleRoutes } from "./routes"

import { createProjectRepository } from "../project"
import type { ProjectDbClient } from "../project"
import { createGitRepository } from "./repositories"
import { createGitService } from "./services"

export function createGitModule(args: { prisma: ProjectDbClient }) {
  const projectRepository = createProjectRepository(args.prisma)
  const gitRepository = createGitRepository()
  const gitService = createGitService({
    projectRepository,
    gitRepository,
  })

  return {
    repositories: {
      projectRepository,
      gitRepository,
    },
    services: {
      gitService,
    },
  }
}
