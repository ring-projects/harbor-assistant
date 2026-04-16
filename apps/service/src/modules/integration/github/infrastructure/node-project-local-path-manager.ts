import { mkdir } from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"

import { buildChildProcessEnv } from "../../../../lib/process-env"
import { AppError } from "../../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../../constants/errors"
import type { ProjectLocalPathManager } from "../application/project-local-path-manager"

function createGitHubAuthorizationHeader(accessToken: string) {
  const basic = Buffer.from(`x-access-token:${accessToken}`).toString("base64")
  return `AUTHORIZATION: basic ${basic}`
}

async function runGitCommand(args: string[], env: NodeJS.ProcessEnv) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("git", args, {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
      env,
    })

    let stderr = ""

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(
        new AppError(
          ERROR_CODES.INTERNAL_ERROR,
          502,
          stderr.trim() || `Git command failed with exit code ${code ?? 1}.`,
        ),
      )
    })
  })
}

function createGitCommandEnv(repositoryUrl: string, accessToken: string) {
  const origin = new URL(repositoryUrl)
  return buildChildProcessEnv({
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `http.${origin.origin}/.extraheader`,
    GIT_CONFIG_VALUE_0: createGitHubAuthorizationHeader(accessToken),
  })
}

export function createNodeProjectLocalPathManager(): ProjectLocalPathManager {
  return {
    async cloneRepository(args) {
      await mkdir(path.dirname(args.targetPath), { recursive: true })

      const commandArgs = ["clone"]
      if (args.branch?.trim()) {
        commandArgs.push("--branch", args.branch.trim())
      }
      commandArgs.push(args.repositoryUrl, args.targetPath)

      await runGitCommand(
        commandArgs,
        createGitCommandEnv(args.repositoryUrl, args.accessToken),
      )
    },
    async syncRepository(args) {
      await runGitCommand(
        ["-C", args.rootPath, "fetch", "--prune", "origin"],
        createGitCommandEnv(args.repositoryUrl, args.accessToken),
      )
    },
  }
}
