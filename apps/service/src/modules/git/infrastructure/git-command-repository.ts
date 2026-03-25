import { spawn } from "node:child_process"

import { buildChildProcessEnv } from "../../../lib/process-env"
import type {
  GitCommandResult,
  GitRepository,
} from "../application/git-repository"

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
      settle({
        stdout,
        stderr: [stderr, readGitCommandError(error)].filter(Boolean).join("\n").trim(),
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

export function createGitCommandRepository(): GitRepository {
  return {
    getRepositoryRoot(path: string) {
      return runGitCommand(["rev-parse", "--show-toplevel"], path)
    },
    getCurrentBranch(path: string) {
      return runGitCommand(["branch", "--show-current"], path)
    },
    getStatus(path: string) {
      return runGitCommand(
        ["status", "--porcelain=v1", "--branch", "--untracked-files=all"],
        path,
      )
    },
    listBranches(path: string) {
      return runGitCommand(["branch", "--format=%(refname:short)"], path)
    },
    getDiff(path: string) {
      return runGitCommand(
        [
          "diff",
          "-U1",
          "--no-color",
          "--no-ext-diff",
          "--find-renames",
          "--find-copies",
          "--binary",
          "HEAD",
          "--",
        ],
        path,
      )
    },
    checkoutBranch(path: string, branchName: string) {
      return runGitCommand(["checkout", branchName], path)
    },
    createBranch(path: string, input) {
      if (input.checkout) {
        const args = ["checkout", "-b", input.branchName]
        if (input.fromRef?.trim()) {
          args.push(input.fromRef.trim())
        }
        return runGitCommand(args, path)
      }

      const args = ["branch", input.branchName]
      if (input.fromRef?.trim()) {
        args.push(input.fromRef.trim())
      }
      return runGitCommand(args, path)
    },
  }
}
