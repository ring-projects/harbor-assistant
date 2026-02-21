import { spawn } from "node:child_process"

import {
  createTask,
  updateTaskRunState,
} from "@/services/tasks/task.repository"
import type { CodexTask } from "@/services/tasks/types"

const MAX_CAPTURED_OUTPUT_LENGTH = 200_000

function nowIsoString() {
  return new Date().toISOString()
}

function appendWithLimit(base: string, nextChunk: string) {
  const combined = `${base}${nextChunk}`
  if (combined.length <= MAX_CAPTURED_OUTPUT_LENGTH) {
    return combined
  }

  return combined.slice(combined.length - MAX_CAPTURED_OUTPUT_LENGTH)
}

function buildCodexExecArgs(args: { workspacePath: string; prompt: string; model: string | null }) {
  const commandArgs = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "--color",
    "never",
    "--cd",
    args.workspacePath,
  ]

  if (args.model) {
    commandArgs.push("--model", args.model)
  }

  commandArgs.push(args.prompt)

  return commandArgs
}

export async function createAndRunCodexTask(input: {
  workspaceId: string
  workspacePath: string
  prompt: string
  model: string | null
}): Promise<CodexTask> {
  const createdTask = await createTask({
    workspaceId: input.workspaceId,
    workspacePath: input.workspacePath,
    prompt: input.prompt,
    model: input.model,
  })

  const commandArgs = buildCodexExecArgs({
    workspacePath: input.workspacePath,
    prompt: input.prompt,
    model: input.model,
  })

  let stdout = ""
  let stderr = ""
  let finalized = false
  let runningTask: CodexTask | null = null

  function finalizeTask(payload: {
    status: "completed" | "failed"
    exitCode: number | null
    error: string | null
  }) {
    if (finalized) {
      return
    }

    finalized = true
    void updateTaskRunState({
      taskId: createdTask.id,
      status: payload.status,
      finishedAt: nowIsoString(),
      exitCode: payload.exitCode,
      stdout,
      stderr,
      error: payload.error,
    })
  }

  try {
    const child = spawn("codex", commandArgs, {
      cwd: input.workspacePath,
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    })

    runningTask = await updateTaskRunState({
      taskId: createdTask.id,
      status: "running",
      startedAt: nowIsoString(),
      command: ["codex", ...commandArgs],
      error: null,
    })

    child.stdout?.on("data", (chunk: Buffer | string) => {
      stdout = appendWithLimit(stdout, String(chunk))
    })

    child.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = appendWithLimit(stderr, String(chunk))
    })

    child.on("error", (error) => {
      finalizeTask({
        status: "failed",
        exitCode: null,
        error: `Failed to execute codex: ${String(error)}`,
      })
    })

    child.on("close", (code) => {
      if (code === 0) {
        finalizeTask({
          status: "completed",
          exitCode: code,
          error: null,
        })
        return
      }

      finalizeTask({
        status: "failed",
        exitCode: code,
        error: `Codex exited with code ${String(code)}`,
      })
    })
  } catch (error) {
    return updateTaskRunState({
      taskId: createdTask.id,
      status: "failed",
      startedAt: nowIsoString(),
      finishedAt: nowIsoString(),
      exitCode: null,
      command: ["codex", ...commandArgs],
      stdout,
      stderr,
      error: `Failed to spawn codex: ${String(error)}`,
    })
  }

  return runningTask ?? createdTask
}
