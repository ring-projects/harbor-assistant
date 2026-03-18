import { spawn } from "node:child_process"
import { createInterface } from "node:readline"

import type { IAgent } from "../interface"
import type {
  AgentCapabilities,
  AgentEvent,
  SessionOptions,
} from "../types"
import { MAX_CAPTURED_OUTPUT_LENGTH } from "../constants"
import {
  buildCodexChildEnv,
  inspectCodexCapabilities,
  resolveBundledCodexRuntime,
} from "../capabilities/codex"
import { logChildProcessSpawnFailure } from "../../process-env"

type ThreadTodoItem = {
  text: string
  completed: boolean
}

type ThreadItem =
  | {
      id: string
      type: "agent_message"
      text: string
    }
  | {
      id: string
      type: "reasoning"
      text: string
    }
  | {
      id: string
      type: "todo_list"
      items: ThreadTodoItem[]
    }
  | {
      id: string
      type: "error"
      message: string
    }
  | {
      id: string
      type: "web_search"
      query: string
    }
  | {
      id: string
      type: "file_change"
      status: "completed" | "failed" | "in_progress"
      changes: Array<{
        path: string
        kind: "add" | "delete" | "update"
      }>
    }
  | {
      id: string
      type: "mcp_tool_call"
      server: string
      tool: string
      arguments: unknown
      result?: unknown
      error?: {
        message?: string
      }
      status: "completed" | "failed" | "in_progress"
    }
  | {
      id: string
      type: "command_execution"
      command: string
      aggregated_output?: string
      exit_code?: number
      status: "completed" | "failed" | "in_progress"
    }

type ThreadEvent =
  | {
      type: "thread.started"
      thread_id: string
    }
  | {
      type: "turn.started"
    }
  | {
      type: "item.started" | "item.updated" | "item.completed"
      item: ThreadItem
    }
  | {
      type: "turn.completed"
      usage?: unknown
    }
  | {
      type: "turn.failed"
      error: {
        message: string
      }
    }
  | {
      type: "error"
      message: string
    }

type Thread = {
  runStreamed: (
    prompt: string,
    options?: {
      signal?: AbortSignal
    },
  ) => Promise<{ events: AsyncIterable<ThreadEvent> }>
}

type CreateCodexClient = (args: {
  env: Record<string, string>
}) => {
  startThread: (options: ReturnType<typeof buildThreadOptions>) => Thread
  resumeThread: (
    sessionId: string,
    options: ReturnType<typeof buildThreadOptions>,
  ) => Thread
}

/**
 * Limit output length
 */
function appendWithLimit(base: string, nextChunk: string): string {
  const combined = `${base}${nextChunk}`
  if (combined.length <= MAX_CAPTURED_OUTPUT_LENGTH) {
    return combined
  }

  return combined.slice(combined.length - MAX_CAPTURED_OUTPUT_LENGTH)
}

function buildProcessEnv(overrides?: Record<string, string>) {
  return buildCodexChildEnv(overrides)
}

/**
 * Build Codex thread options
 */
function buildThreadOptions(options: SessionOptions) {
  return {
    workingDirectory: options.workingDirectory,
    model: options.model ?? undefined,
    sandboxMode: options.sandboxMode ?? "workspace-write",
    approvalPolicy: options.approvalPolicy ?? "never",
    networkAccessEnabled: options.networkAccessEnabled ?? false,
    webSearchMode: options.webSearchMode ?? undefined,
    additionalDirectories: options.additionalDirectories ?? undefined,
    skipGitRepoCheck: true,
  }
}

function buildCodexCliArgs(args: {
  prompt: string
  env: Record<string, string>
  threadId?: string
  options: ReturnType<typeof buildThreadOptions>
}) {
  const runtime = resolveBundledCodexRuntime()
  if (!runtime) {
    throw new Error("Bundled Codex runtime is not available.")
  }

  const commandArgs = ["exec", "--experimental-json"]
  const options = args.options

  if (options.model) {
    commandArgs.push("--model", options.model)
  }

  if (options.sandboxMode) {
    commandArgs.push("--sandbox", options.sandboxMode)
  }

  if (options.workingDirectory) {
    commandArgs.push("--cd", options.workingDirectory)
  }

  if (options.additionalDirectories?.length) {
    for (const directory of options.additionalDirectories) {
      commandArgs.push("--add-dir", directory)
    }
  }

  if (options.skipGitRepoCheck) {
    commandArgs.push("--skip-git-repo-check")
  }

  commandArgs.push(
    "--config",
    `sandbox_workspace_write.network_access=${options.networkAccessEnabled ?? false}`,
  )

  if (options.webSearchMode) {
    commandArgs.push("--config", `web_search="${options.webSearchMode}"`)
  }

  if (options.approvalPolicy) {
    commandArgs.push("--config", `approval_policy="${options.approvalPolicy}"`)
  }

  if (args.threadId) {
    commandArgs.push("resume", args.threadId)
  }

  return {
    command: runtime.command,
    commandArgs,
    prompt: args.prompt,
    env: args.env,
  }
}

class CliBackedThread implements Thread {
  constructor(
    private readonly threadId: string | null,
    private readonly options: ReturnType<typeof buildThreadOptions>,
    private readonly env: Record<string, string>,
  ) {}

  async runStreamed(
    prompt: string,
    options?: {
      signal?: AbortSignal
    },
  ) {
    const childEnv = buildProcessEnv(this.env)

    return {
      events: (async function* (
        threadId: string | null,
        threadOptions: ReturnType<typeof buildThreadOptions>,
        env: Record<string, string>,
        input: string,
        signal?: AbortSignal,
      ) {
        const runtime = buildCodexCliArgs({
          prompt: input,
          env,
          threadId: threadId ?? undefined,
          options: threadOptions,
        })

        let child
        try {
          child = spawn(runtime.command, runtime.commandArgs, {
            env: runtime.env,
            cwd: threadOptions.workingDirectory,
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
          })
        } catch (error) {
          logChildProcessSpawnFailure({
            scope: "codex.runStreamed",
            command: runtime.command,
            args: runtime.commandArgs,
            cwd: threadOptions.workingDirectory,
            error,
          })
          throw error
        }

        const stdout = child.stdout
        const stderr = child.stderr
        const stdin = child.stdin

        if (!stdout || !stderr || !stdin) {
          child.kill("SIGTERM")
          throw new Error("Codex process did not expose stdio streams.")
        }

        const readline = createInterface({
          input: stdout,
          crlfDelay: Infinity,
        })

        const stderrChunks: Buffer[] = []
        let spawnError: Error | null = null

        stderr.on("data", (chunk) => {
          stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })

        child.once("error", (error) => {
          spawnError = error
        })

        stdin.write(runtime.prompt)
        stdin.end()

        const closePromise = new Promise<{
          code: number | null
          signal: NodeJS.Signals | null
        }>((resolve) => {
          child.once("close", (code, closeSignal) => {
            resolve({ code, signal: closeSignal })
          })
        })

        let aborted = false
        const abort = () => {
          aborted = true
          try {
            child.kill("SIGTERM")
          } catch {
            // ignore abort cleanup errors
          }
        }

        signal?.addEventListener("abort", abort, { once: true })

        try {
          for await (const line of readline) {
            let parsed: ThreadEvent

            try {
              parsed = JSON.parse(line) as ThreadEvent
            } catch (error) {
              throw new Error(`Failed to parse Codex event: ${line}`, {
                cause: error,
              })
            }

            yield parsed
          }

          if (spawnError) {
            throw spawnError
          }

          const { code, signal: closeSignal } = await closePromise
          if (!aborted && (code !== 0 || closeSignal)) {
            const stderrBuffer = Buffer.concat(stderrChunks)
            const detail = closeSignal
              ? `signal ${closeSignal}`
              : `code ${code ?? 1}`
            throw new Error(
              `Codex Exec exited with ${detail}: ${stderrBuffer.toString("utf8")}`,
            )
          }
        } finally {
          readline.close()
          signal?.removeEventListener("abort", abort)
          child.removeAllListeners()
          try {
            if (!child.killed) {
              child.kill("SIGTERM")
            }
          } catch {
            // ignore cleanup errors
          }
        }
      })(this.threadId, this.options, childEnv, prompt, options?.signal),
    }
  }
}

function createBundledCodexClient(args: {
  env: Record<string, string>
}) {
  return {
    startThread: (options: ReturnType<typeof buildThreadOptions>) =>
      new CliBackedThread(null, options, args.env),
    resumeThread: (
      sessionId: string,
      options: ReturnType<typeof buildThreadOptions>,
    ) => new CliBackedThread(sessionId, options, args.env),
  }
}

/**
 * Convert Codex ThreadItem to AgentEvent
 */
export function convertThreadItemToEvent(
  eventType: ThreadEvent["type"],
  item: ThreadItem,
): AgentEvent | null {
  const timestamp = new Date()

  switch (item.type) {
    case "agent_message":
      if (eventType === "item.completed" && item.text.trim()) {
        return {
          type: "message",
          role: "assistant",
          content: item.text,
          source: "agent_message",
          externalId: item.id,
          timestamp,
        }
      }
      return null

    case "reasoning":
      if (eventType === "item.completed" && item.text.trim()) {
        return {
          type: "reasoning",
          content: item.text,
          timestamp,
        }
      }
      return null

    case "todo_list":
      if (eventType === "item.completed") {
        return {
          type: "todo_list",
          items: item.items.map((entry) => ({
            text: entry.text,
            completed: entry.completed,
          })),
          timestamp,
        }
      }
      return null

    case "error":
      if (eventType === "item.completed") {
        return {
          type: "error",
          message: item.message,
          timestamp,
        }
      }
      return null

    case "web_search":
      if (eventType === "item.started") {
        return {
          type: "web_search.started",
          searchId: item.id,
          query: item.query,
          timestamp,
        }
      }

      if (eventType === "item.completed") {
        return {
          type: "web_search.completed",
          searchId: item.id,
          query: item.query,
          timestamp,
        }
      }
      return null

    case "file_change":
      if (eventType === "item.completed") {
        return {
          type: "file_change",
          changeId: item.id,
          status: item.status === "completed" ? "success" : "failed",
          changes: item.changes.map((change) => ({
            path: change.path,
            kind: change.kind,
          })),
          timestamp,
        }
      }
      return null

    case "mcp_tool_call":
      if (eventType === "item.started") {
        return {
          type: "mcp_tool_call.started",
          callId: item.id,
          server: item.server,
          tool: item.tool,
          arguments: item.arguments,
          timestamp,
        }
      }

      if (eventType === "item.completed") {
        return {
          type: "mcp_tool_call.completed",
          callId: item.id,
          server: item.server,
          tool: item.tool,
          arguments: item.arguments,
          result: item.result,
          error: item.error?.message,
          status: item.status === "completed" ? "success" : "failed",
          timestamp,
        }
      }
      return null

    default:
      return null
  }
}

/**
 * Codex agent adapter
 */
export class CodexAdapter implements IAgent {
  constructor(
    private readonly createCodexClient: CreateCodexClient = createBundledCodexClient,
  ) {}

  getType(): string {
    return "codex"
  }

  async *startSessionAndRun(
    options: SessionOptions,
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const thread = this.createCodexClient({
      env: buildProcessEnv(options.env),
    }).startThread(buildThreadOptions(options))
    yield* this.runStreamed(thread, prompt, options.displayPrompt, signal)
  }

  async *resumeSessionAndRun(
    sessionId: string,
    options: SessionOptions,
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const thread = this.createCodexClient({
      env: buildProcessEnv(options.env),
    }).resumeThread(sessionId, buildThreadOptions(options))
    yield* this.runStreamed(thread, prompt, options.displayPrompt, signal)
  }

  async getCapabilities(): Promise<AgentCapabilities> {
    return inspectCodexCapabilities()
  }

  private async *runStreamed(
    thread: Thread,
    prompt: string,
    displayPrompt: string | undefined,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    let sessionId: string | null = null
    const commandOutputs = new Map<string, string>()
    let userMessageEmitted = false

    const { events } = await thread.runStreamed(prompt, { signal })

    for await (const event of events) {
      const timestamp = new Date()

      switch (event.type) {
        case "thread.started": {
          sessionId = event.thread_id
          yield {
            type: "session.started",
            sessionId: event.thread_id,
            timestamp,
          }

          if (!userMessageEmitted) {
            userMessageEmitted = true
            yield {
              type: "message",
              role: "user",
              content: displayPrompt ?? prompt,
              source: "user_prompt",
              timestamp,
            }
          }
          break
        }

        case "turn.started": {
          yield {
            type: "turn.started",
            timestamp,
          }
          break
        }

        case "item.started":
        case "item.updated":
        case "item.completed": {
          const item = event.item

          if (item.type === "command_execution") {
            const previous = commandOutputs.get(item.id) ?? ""
            const next = item.aggregated_output ?? ""
            const delta = next.startsWith(previous)
              ? next.slice(previous.length)
              : next
            commandOutputs.set(item.id, next)

            if (event.type === "item.started") {
              yield {
                type: "command.started",
                commandId: item.id,
                command: item.command,
                timestamp,
              }
            }

            if (delta) {
              yield {
                type: "command.output",
                commandId: item.id,
                output: delta,
                timestamp,
              }
            }

            if (event.type === "item.completed") {
              yield {
                type: "command.completed",
                commandId: item.id,
                exitCode: item.exit_code ?? undefined,
                status: item.status === "completed" ? "success" : "failed",
                timestamp,
              }
            }
            break
          }

          const agentEvent = convertThreadItemToEvent(event.type, item)
          if (agentEvent) {
            yield agentEvent
          }
          break
        }

        case "turn.completed": {
          yield {
            type: "turn.completed",
            timestamp,
          }
          break
        }

        case "turn.failed": {
          yield {
            type: "turn.failed",
            error: event.error.message,
            timestamp,
          }
          break
        }

        case "error": {
          yield {
            type: "error",
            message: event.message,
            timestamp,
          }
          break
        }
      }
    }

    if (sessionId) {
      yield {
        type: "session.completed",
        timestamp: new Date(),
      }
    }
  }
}

/**
 * Codex adapter singleton
 */
export const codexAdapter = new CodexAdapter()
