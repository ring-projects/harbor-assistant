export { createGitService } from "./git.service"
export { parseUnifiedDiff, readProjectGitDiff } from "./git-diff.service"
export { createProjectGitWatcher } from "./project-git-watcher.service"
export type {
  CheckoutGitBranchInput,
  CreateGitBranchInput,
  GetGitDiffInput,
  GetGitRepositorySummaryInput,
  GitService,
  ListGitBranchesInput,
} from "./git.service"
export type {
  ProjectGitChangeEvent,
  ProjectGitWatcher,
  ProjectGitWatcherListener,
} from "./project-git-watcher.service"
