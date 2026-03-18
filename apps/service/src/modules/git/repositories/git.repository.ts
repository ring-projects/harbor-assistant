import { spawn } from "node:child_process"

import {
  buildChildProcessEnv,
  logChildProcessSpawnFailure,
} from "../../../lib/process-env"

export type GitCommandResult = {
  stdout: string
  stderr: string
  exitCode: number | null
}

function readGitCommandError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return String(error)
  }

  const message =
    "message" in error && typeof error.message === "string" ? error.message : ""

  return message.trim()
}

export async function runGitCommand(
  args: string[],
  cwd: string,
): Promise<GitCommandResult> {
  return new Promise((resolve) => {
    let child
    try {
      child = spawn("git", args, {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
        env: buildChildProcessEnv(),
      })
    } catch (error) {
      logChildProcessSpawnFailure({
        scope: "git.runGitCommand",
        command: "git",
        args,
        cwd,
        error,
      })
      resolve({
        stdout: "",
        stderr: readGitCommandError(error),
        exitCode: null,
      })
      return
    }

    let stdout = ""
    let stderr = ""
    let settled = false

    function settle(result: GitCommandResult) {
      if (settled) {
        return
      }

      settled = true
      resolve(result)
    }

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })

    child.on("error", (error) => {
      const message = readGitCommandError(error)
      settle({
        stdout,
        stderr: [stderr, message].filter(Boolean).join("\n").trim(),
        exitCode: null,
      })
    })

    child.on("close", (code) => {
      settle({
        stdout,
        stderr: stderr.trim(),
        exitCode: code,
      })
    })
  })
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
