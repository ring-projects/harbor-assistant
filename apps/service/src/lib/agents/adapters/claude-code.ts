import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { createInterface } from "node:readline"

import type { IAgent } from "../interface"
import type { AgentCapabilities, SessionOptions, AgentEvent } from "../types"
import { inspectClaudeCodeCapabilities } from "../capabilities/claude-code"
import { AGENT_COMMANDS, MAX_CAPTURED_OUTPUT_LENGTH } from "../constants"
import { findInstalledCommand } from "../utils/command"

export const claudeCodeProcess = {
  spawn,
  findInstalledCommand,
}

type ClaudePermissionMode =
  | "acceptEdits"
  | "bypassPermissions"
  | "default"
  | "dontAsk"
  | "plan"
  | "auto"

type ClaudeContentBlock =
  | {
      type?: unknown
      text?: unknown
      name?: unknown
      id?: unknown
      input?: unknown
      tool_use_id?: unknown
      content?: unknown
      is_error?: unknown
      thinking?: unknown
    }
  | string

type ClaudeStreamMessage = {
  role?: unknown
  content?: unknown
}

type ClaudeStreamEvent = {
  type?: unknown
  subtype?: unknown
  session_id?: unknown
  message?: unknown
  result?: unknown
  error?: unknown
}

function appendWithLimit(base: string, nextChunk: string): string {
  const combined = `${base}${nextChunk}`
  if (combined.length <= MAX_CAPTURED_OUTPUT_LENGTH) {
    return combined
  }

  return combined.slice(combined.length - MAX_CAPTURED_OUTPUT_LENGTH)
}

function toJsonString(value: unknown) {
  if (typeof value === "string") {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function extractContentBlocks(value: unknown): ClaudeContentBlock[] {
  if (typeof value === "string") {
    return [value]
  }

  if (!Array.isArray(value)) {
    return []
  }

  return value as ClaudeContentBlock[]
}

function extractTextFromBlock(block: ClaudeContentBlock): string {
  if (typeof block === "string") {
    return block
  }

  if (!block || typeof block !== "object") {
    return ""
  }

  if (typeof block.text === "string") {
    return block.text
  }

  if (typeof block.thinking === "string") {
    return block.thinking
  }

  if (typeof block.content === "string") {
    return block.content
  }

  if (Array.isArray(block.content)) {
    return block.content.map((item) => extractTextFromBlock(item)).join("")
  }

  return ""
}

function extractTextFromContent(content: unknown): string {
  return extractContentBlocks(content)
    .map((block) => extractTextFromBlock(block))
    .join("")
    .trim()
}

function normalizeClaudeMessage(value: unknown): ClaudeStreamMessage | null {
  if (typeof value !== "object" || value === null) {
    return null
  }

  return value as ClaudeStreamMessage
}

function formatToolCommand(name: string, input: unknown) {
  const serializedInput = toJsonString(input)
  return serializedInput === "{}" ? name : `${name} ${serializedInput}`
}

function mapApprovalPolicyToPermissionMode(
  approvalPolicy: SessionOptions["approvalPolicy"],
): ClaudePermissionMode {
  switch (approvalPolicy) {
    case "never":
      return "bypassPermissions"
    case "on-request":
      return "default"
    case "untrusted":
      return "plan"
    default:
      return "bypassPermissions"
  }
}

function buildClaudeArgs(args: {
  options: SessionOptions
  prompt: string
  sessionId?: string
  resumeSessionId?: string
}) {
  const permissionMode = mapApprovalPolicyToPermissionMode(
    args.options.approvalPolicy,
  )
  const cliArgs = [
    "-p",
    "--verbose",
    "--output-format",
    "stream-json",
    "--permission-mode",
    permissionMode,
    "--disallowedTools",
    args.options.networkAccessEnabled === false
      ? "WebFetch,WebSearch,AskUserQuestion"
      : "AskUserQuestion",
    "--add-dir",
    args.options.workingDirectory,
  ]

  for (const directory of args.options.additionalDirectories ?? []) {
    cliArgs.push("--add-dir", directory)
  }

  if (args.options.model) {
    cliArgs.push("--model", args.options.model)
  }

  if (args.resumeSessionId) {
    cliArgs.push("--resume", args.resumeSessionId)
  } else if (args.sessionId) {
    cliArgs.push("--session-id", args.sessionId)
  }

  cliArgs.push(args.prompt)
  return cliArgs
}

function convertClaudeMessageToEvents(
  message: ClaudeStreamMessage,
  timestamp: Date,
): AgentEvent[] {
  const events: AgentEvent[] = []
  const content = extractContentBlocks(message.content)

  for (const block of content) {
    if (typeof block === "string") {
      continue
    }

    if (!block || typeof block !== "object") {
      continue
    }

    if (block.type === "thinking") {
      const thinking = extractTextFromBlock(block)
      if (thinking) {
        events.push({
          type: "reasoning",
          content: thinking,
          timestamp,
        })
      }
      continue
    }

    if (block.type === "tool_use") {
      const commandId = typeof block.id === "string" ? block.id : randomUUID()
      const commandName =
        typeof block.name === "string" ? block.name : "claude-tool"

      events.push({
        type: "command.started",
        commandId,
        command: formatToolCommand(commandName, block.input),
        timestamp,
      })
      continue
    }

    if (block.type === "tool_result") {
      const commandId =
        typeof block.tool_use_id === "string" ? block.tool_use_id : randomUUID()
      const output = extractTextFromBlock(block)
      if (output) {
        events.push({
          type: "command.output",
          commandId,
          output,
          timestamp,
        })
      }

      events.push({
        type: "command.completed",
        commandId,
        status: block.is_error === true ? "failed" : "success",
        timestamp,
      })
    }
  }

  const text = extractTextFromContent(message.content)
  if (text && message.role === "assistant") {
    events.push({
      type: "message",
      role: "assistant",
      content: text,
      source: "assistant_message",
      timestamp,
    })
  }

  return events
}

async function resolveClaudeCommand() {
  const command = await claudeCodeProcess.findInstalledCommand(
    AGENT_COMMANDS["claude-code"],
  )
  if (!command) {
    throw new Error("Claude Code CLI is not installed.")
  }

  return command
}

/**
 * Claude Code agent adapter
 */
export class ClaudeCodeAdapter implements IAgent {
  getType(): string {
    return "claude-code"
  }

  async *startSessionAndRun(
    options: SessionOptions,
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const sessionId = randomUUID()
    yield* this.runCliStream(
      buildClaudeArgs({
        options,
        prompt,
        sessionId,
      }),
      {
        workingDirectory: options.workingDirectory,
        fallbackSessionId: sessionId,
        prompt,
        displayPrompt: options.displayPrompt,
        env: options.env,
        signal,
      },
    )
  }

  async *resumeSessionAndRun(
    sessionId: string,
    options: SessionOptions,
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    yield* this.runCliStream(
      buildClaudeArgs({
        options,
        prompt,
        resumeSessionId: sessionId,
      }),
      {
        workingDirectory: options.workingDirectory,
        fallbackSessionId: sessionId,
        prompt,
        displayPrompt: options.displayPrompt,
        env: options.env,
        signal,
      },
    )
  }

  async getCapabilities(): Promise<AgentCapabilities> {
    return inspectClaudeCodeCapabilities()
  }

  private async *runCliStream(
    cliArgs: string[],
    args: {
      workingDirectory: string
      fallbackSessionId: string
      prompt: string
      displayPrompt?: string
      env?: Record<string, string>
      signal?: AbortSignal
    },
  ): AsyncIterable<AgentEvent> {
    const command = await resolveClaudeCommand()
    const child = claudeCodeProcess.spawn(command, cliArgs, {
      cwd: args.workingDirectory,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ...(args.env ?? {}),
        NO_COLOR: "1",
      },
    })

    const stdout = child.stdout
    const stderr = child.stderr
    if (!stdout || !stderr) {
      child.kill("SIGTERM")
      throw new Error("Claude Code process did not expose stdio streams.")
    }

    let bufferedStderr = ""
    let emittedSessionStart = false
    let emittedTurnStart = false
    let terminalError: string | null = null
    let sawTurnEnd = false
    let sawSessionCompletion = false

    const queue: AgentEvent[] = []
    let isClosed = false
    let wake: (() => void) | null = null

    const notify = () => {
      wake?.()
      wake = null
    }

    const pushEvent = (event: AgentEvent) => {
      queue.push(event)
      notify()
    }

    const closeQueue = () => {
      isClosed = true
      notify()
    }

    const emitSessionPreamble = (sessionId: string) => {
      if (!emittedSessionStart) {
        emittedSessionStart = true
        pushEvent({
          type: "session.started",
          sessionId,
          timestamp: new Date(),
        })
      }

      if (!emittedTurnStart) {
        emittedTurnStart = true
        pushEvent({
          type: "message",
          role: "user",
          content: args.displayPrompt ?? args.prompt,
          source: "user_prompt",
          timestamp: new Date(),
        })
        pushEvent({
          type: "turn.started",
          timestamp: new Date(),
        })
      }
    }

    const emitSessionCompleted = () => {
      if (emittedSessionStart && !sawSessionCompletion) {
        sawSessionCompletion = true
        pushEvent({
          type: "session.completed",
          timestamp: new Date(),
        })
      }
    }

    const stdoutLines = createInterface({
      input: stdout,
      crlfDelay: Infinity,
    })

    stdoutLines.on("line", (line) => {
      let rawEvent: ClaudeStreamEvent
      try {
        rawEvent = JSON.parse(line) as ClaudeStreamEvent
      } catch {
        return
      }

      const timestamp = new Date()

      if (rawEvent.type === "system" && rawEvent.subtype === "init") {
        const sessionId =
          typeof rawEvent.session_id === "string"
            ? rawEvent.session_id
            : args.fallbackSessionId
        emitSessionPreamble(sessionId)
        return
      }

      if (!emittedSessionStart) {
        emitSessionPreamble(args.fallbackSessionId)
      }

      if (rawEvent.type === "assistant" || rawEvent.type === "user") {
        const message = normalizeClaudeMessage(
          rawEvent.message ?? {
            role: rawEvent.type,
            content: rawEvent.result,
          },
        )
        if (!message) {
          return
        }

        for (const event of convertClaudeMessageToEvents(message, timestamp)) {
          pushEvent(event)
        }
        return
      }

      if (
        (rawEvent.type === "system" && rawEvent.subtype === "result") ||
        rawEvent.type === "result"
      ) {
        const resultText = extractTextFromContent(rawEvent.result)
        if (resultText) {
          pushEvent({
            type: "message",
            role: "assistant",
            content: resultText,
            source: "result",
            timestamp,
          })
        }

        const isError =
          typeof rawEvent.result === "object" &&
          rawEvent.result !== null &&
          "is_error" in rawEvent.result &&
          rawEvent.result.is_error === true

        if (isError) {
          const resultError =
            typeof rawEvent.result === "object" &&
            rawEvent.result !== null &&
            "result" in rawEvent.result &&
            typeof rawEvent.result.result === "string"
              ? rawEvent.result.result
              : "Claude Code task failed."

          terminalError = resultError
          pushEvent({
            type: "turn.failed",
            error: resultError,
            timestamp,
          })
        } else {
          sawTurnEnd = true
          pushEvent({
            type: "turn.completed",
            timestamp,
          })
        }

        emitSessionCompleted()
        return
      }

      if (rawEvent.type === "error") {
        const message =
          typeof rawEvent.error === "string"
            ? rawEvent.error
            : "Claude Code task failed."
        terminalError = message
        pushEvent({
          type: "error",
          message,
          timestamp,
        })
      }
    })

    stderr.on("data", (chunk) => {
      bufferedStderr = appendWithLimit(bufferedStderr, chunk.toString("utf8"))
    })

    let aborted = false
    const handleAbort = () => {
      aborted = true
      terminalError =
        typeof args.signal?.reason === "string"
          ? args.signal.reason
          : "Claude Code task aborted."
      child.kill("SIGTERM")
    }

    if (args.signal) {
      if (args.signal.aborted) {
        handleAbort()
      } else {
        args.signal.addEventListener("abort", handleAbort, { once: true })
      }
    }

    child.on("error", (error) => {
      terminalError = String(error)
      closeQueue()
    })

    child.on("close", (code, closeSignal) => {
      stdoutLines.close()

      if (args.signal) {
        args.signal.removeEventListener("abort", handleAbort)
      }

      if (!sawTurnEnd && !terminalError && code === 0) {
        pushEvent({
          type: "turn.completed",
          timestamp: new Date(),
        })
      }

      if (bufferedStderr.trim().length > 0 && code && !terminalError && !aborted) {
        terminalError = bufferedStderr.trim()
      } else if (
        !terminalError &&
        code &&
        !aborted &&
        typeof closeSignal === "string"
      ) {
        terminalError = `Claude Code exited with signal ${closeSignal}.`
      } else if (!terminalError && code && !aborted) {
        terminalError = `Claude Code exited with code ${code}.`
      }

      emitSessionCompleted()
      closeQueue()
    })

    while (queue.length > 0 || !isClosed) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve
        })
        continue
      }

      const next = queue.shift()
      if (next) {
        yield next
      }
    }

    if (terminalError) {
      throw new Error(terminalError)
    }
  }
}

/**
 * Claude Code adapter singleton
 */
export const claudeCodeAdapter = new ClaudeCodeAdapter()
