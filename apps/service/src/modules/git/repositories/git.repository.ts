import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type GitCommandResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

function readGitCommandError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return String(error)
  }

  const stderr =
    "stderr" in error && typeof error.stderr === "string" ? error.stderr : ""
  const stdout =
    "stdout" in error && typeof error.stdout === "string" ? error.stdout : ""
  const message =
    "message" in error && typeof error.message === "string" ? error.message : ""

  return [stderr, stdout, message].filter(Boolean).join("\n").trim()
}

export async function runGitCommand(
  args: string[],
  cwd: string,
): Promise<GitCommandResult> {
  try {
    const result = await execFileAsync("git", args, {
      cwd,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    })

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    }
  } catch (error) {
    const exitCode =
      typeof error === "object" && error !== null && "code" in error
        ? Number((error as { code?: unknown }).code)
        : null

    return {
      stdout:
        typeof error === "object" && error !== null && "stdout" in error
          ? String((error as { stdout?: unknown }).stdout ?? "")
          : "",
      stderr: readGitCommandError(error),
      exitCode: Number.isInteger(exitCode) ? exitCode : null,
    }
  }
}

export function createGitRepository() {
  async function getRepositoryRoot(cwd: string) {
    return runGitCommand(["rev-parse", "--show-toplevel"], cwd)
  }

  async function getCurrentBranch(cwd: string) {
    return runGitCommand(["branch", "--show-current"], cwd)
  }

  async function getStatus(cwd: string) {
    return runGitCommand(
      ["status", "--porcelain=v1", "--branch", "--untracked-files=all"],
      cwd,
    )
  }

  async function listBranches(cwd: string) {
    return runGitCommand(["branch", "--format=%(refname:short)"], cwd)
  }

  async function hasBranch(cwd: string, branchName: string) {
    return runGitCommand(
      ["show-ref", "--verify", "--quiet", `refs/heads/${branchName}`],
      cwd,
    )
  }

  async function validateBranchName(branchName: string, cwd: string) {
    return runGitCommand(["check-ref-format", "--branch", branchName], cwd)
  }

  async function checkoutBranch(cwd: string, branchName: string) {
    return runGitCommand(["checkout", branchName], cwd)
  }

  async function createBranch(
    cwd: string,
    args: {
      branchName: string
      checkout?: boolean
      fromRef?: string | null
    },
  ) {
    if (args.checkout) {
      const commandArgs = ["checkout", "-b", args.branchName]
      if (args.fromRef?.trim()) {
        commandArgs.push(args.fromRef.trim())
      }

      return runGitCommand(commandArgs, cwd)
    }

    const commandArgs = ["branch", args.branchName]
    if (args.fromRef?.trim()) {
      commandArgs.push(args.fromRef.trim())
    }

    return runGitCommand(commandArgs, cwd)
  }

  return {
    getRepositoryRoot,
    getCurrentBranch,
    getStatus,
    listBranches,
    hasBranch,
    validateBranchName,
    checkoutBranch,
    createBranch,
  }
}

export type GitRepository = ReturnType<typeof createGitRepository>
