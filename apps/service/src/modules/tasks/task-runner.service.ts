import {
  type ChildProcess,
  spawn,
} from "node:child_process"

import { DEFAULT_CODEX_COMMAND } from "../../constants/executors"
import {
  appendTaskEvent,
  createTask,
  getTaskById,
  updateTaskRunState,
} from "./task.repository"
import type { CodexTask } from "./types"

const MAX_CAPTURED_OUTPUT_LENGTH = 200_000
const CANCEL_KILL_TIMEOUT_MS = 3_000
const MAX_STDOUT_LINE_BUFFER_LENGTH = 100_000
const CODEX_SESSION_EVENT_KIND = "codex-session"

type RunningCodexProcess = {
  child: ChildProcess
  cancellationRequested: boolean
  cancellationReason: string | null
  forceKillTimer: ReturnType<typeof setTimeout> | null
}

const runningCodexProcesses = new Map<string, RunningCodexProcess>()

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function parseJsonLine(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function extractCodexSessionMetadata(line: Record<string, unknown>) {
  if (line.type !== "session_meta") {
    return null
  }

  const payload = line.payload
  if (!isRecord(payload)) {
    return null
  }

  const threadId = typeof payload.id === "string" ? payload.id : null
  if (!threadId) {
    return null
  }

  const rolloutPath =
    typeof payload.rollout_path === "string"
      ? payload.rollout_path
      : typeof payload.rolloutPath === "string"
        ? payload.rolloutPath
        : null

  return {
    threadId,
    rolloutPath,
  }
}

function buildCodexExecArgs(args: {
  projectPath: string
  prompt: string
  model: string | null
}) {
  const commandArgs = [
    "exec",
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "--color",
    "never",
    "--cd",
    args.projectPath,
  ]

  if (args.model) {
    commandArgs.push("--model", args.model)
  }

  commandArgs.push("--json")
  commandArgs.push(args.prompt)

  return commandArgs
}

export async function createAndRunCodexTask(input: {
  projectId: string
  projectPath: string
  prompt: string
  model: string | null
}): Promise<CodexTask> {
  const createdTask = await createTask({
    projectId: input.projectId,
    projectPath: input.projectPath,
    prompt: input.prompt,
    model: input.model,
  })

  const commandArgs = buildCodexExecArgs({
    projectPath: input.projectPath,
    prompt: input.prompt,
    model: input.model,
  })

  let stdout = ""
  let stderr = ""
  let stdoutLineBuffer = ""
  let finalized = false
  let runningTask: CodexTask | null = null
  let childProcess: ChildProcess | null = null
  let codexThreadId: string | null = null
  let codexRolloutPath: string | null = null
  let codexSessionMetadataPersisted = false

  function getRunningProcess() {
    return runningCodexProcesses.get(createdTask.id) ?? null
  }

  function clearRunningProcess() {
    const runningProcess = getRunningProcess()
    if (!runningProcess) {
      return
    }

    if (runningProcess.forceKillTimer) {
      clearTimeout(runningProcess.forceKillTimer)
    }

    runningCodexProcesses.delete(createdTask.id)
  }

  function persistCodexSessionMetadata() {
    if (codexSessionMetadataPersisted || !codexThreadId) {
      return
    }

    codexSessionMetadataPersisted = true
    void appendTaskEvent({
      taskId: createdTask.id,
      type: "system",
      payload: JSON.stringify({
        kind: CODEX_SESSION_EVENT_KIND,
        threadId: codexThreadId,
        rolloutPath: codexRolloutPath,
      }),
    }).catch(() => {
      codexSessionMetadataPersisted = false
    })
  }

  function consumeStdoutLine(line: string) {
    const normalized = line.trim()
    if (!normalized) {
      return
    }

    const parsedLine = parseJsonLine(normalized)
    if (!parsedLine) {
      return
    }

    const metadata = extractCodexSessionMetadata(parsedLine)
    if (!metadata) {
      return
    }

    codexThreadId = metadata.threadId
    codexRolloutPath = metadata.rolloutPath
    persistCodexSessionMetadata()
  }

  function flushStdoutLineBuffer() {
    const remaining = stdoutLineBuffer.trim()
    stdoutLineBuffer = ""
    if (!remaining) {
      return
    }

    consumeStdoutLine(remaining)
  }

  function finalizeTask(payload: {
    status: "completed" | "failed" | "cancelled"
    exitCode: number | null
    error: string | null
  }) {
    if (finalized) {
      return
    }

    finalized = true
    clearRunningProcess()
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
    const spawnedChild = spawn(DEFAULT_CODEX_COMMAND, commandArgs, {
      cwd: input.projectPath,
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    })
    childProcess = spawnedChild

    runningCodexProcesses.set(createdTask.id, {
      child: spawnedChild,
      cancellationRequested: false,
      cancellationReason: null,
      forceKillTimer: null,
    })

    runningTask = await updateTaskRunState({
      taskId: createdTask.id,
      status: "running",
      startedAt: nowIsoString(),
      command: [DEFAULT_CODEX_COMMAND, ...commandArgs],
      error: null,
    })

    spawnedChild.stdout?.on("data", (chunk: Buffer | string) => {
      const text = String(chunk)
      stdout = appendWithLimit(stdout, text)
      stdoutLineBuffer = `${stdoutLineBuffer}${text}`.slice(
        -MAX_STDOUT_LINE_BUFFER_LENGTH,
      )

      while (true) {
        const nextLineBreak = stdoutLineBuffer.indexOf("\n")
        if (nextLineBreak < 0) {
          break
        }

        const line = stdoutLineBuffer.slice(0, nextLineBreak)
        stdoutLineBuffer = stdoutLineBuffer.slice(nextLineBreak + 1)
        consumeStdoutLine(line)
      }
    })

    spawnedChild.stderr?.on("data", (chunk: Buffer | string) => {
      stderr = appendWithLimit(stderr, String(chunk))
    })

    spawnedChild.on("error", (error) => {
      flushStdoutLineBuffer()

      const runningProcess = getRunningProcess()
      if (runningProcess?.cancellationRequested) {
        finalizeTask({
          status: "cancelled",
          exitCode: null,
          error:
            runningProcess.cancellationReason ??
            "Task cancelled by user request.",
        })
        return
      }

      finalizeTask({
        status: "failed",
        exitCode: null,
        error: `Failed to execute codex: ${String(error)}`,
      })
    })

    spawnedChild.on("close", (code) => {
      flushStdoutLineBuffer()

      const runningProcess = getRunningProcess()
      if (runningProcess?.cancellationRequested) {
        finalizeTask({
          status: "cancelled",
          exitCode: code,
          error:
            runningProcess.cancellationReason ??
            "Task cancelled by user request.",
        })
        return
      }

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
    clearRunningProcess()
    childProcess?.kill("SIGTERM")

    return updateTaskRunState({
      taskId: createdTask.id,
      status: "failed",
      startedAt: nowIsoString(),
      finishedAt: nowIsoString(),
      exitCode: null,
      command: [DEFAULT_CODEX_COMMAND, ...commandArgs],
      stdout,
      stderr,
      error: `Failed to spawn codex: ${String(error)}`,
    })
  }

  return runningTask ?? createdTask
}

function isTerminalStatus(status: CodexTask["status"]) {
  return status === "completed" || status === "failed" || status === "cancelled"
}

export async function cancelCodexTask(input: {
  taskId: string
  reason?: string
}): Promise<CodexTask> {
  const taskId = input.taskId.trim()
  if (!taskId) {
    throw new Error("Task id cannot be empty.")
  }

  const existing = await getTaskById(taskId)
  if (!existing) {
    throw new Error(`Task not found: ${taskId}`)
  }

  if (isTerminalStatus(existing.status)) {
    return existing
  }

  const reason = input.reason?.trim() || "Task cancelled by user request."
  const runningProcess = runningCodexProcesses.get(taskId)
  if (runningProcess) {
    runningProcess.cancellationRequested = true
    runningProcess.cancellationReason = reason

    if (!runningProcess.child.killed) {
      runningProcess.child.kill("SIGTERM")
    }

    if (runningProcess.forceKillTimer) {
      clearTimeout(runningProcess.forceKillTimer)
    }

    runningProcess.forceKillTimer = setTimeout(() => {
      if (!runningProcess.child.killed) {
        runningProcess.child.kill("SIGKILL")
      }
    }, CANCEL_KILL_TIMEOUT_MS)
  }

  return updateTaskRunState({
    taskId,
    status: "cancelled",
    finishedAt: nowIsoString(),
    error: reason,
  })
}
