import {
  Codex,
  type CommandExecutionItem,
  type Thread,
  type ThreadEvent,
  type ThreadItem,
} from "@openai/codex-sdk"

import type { IAgent } from "../interface"
import type {
  AgentCapabilities,
  AgentEvent,
  SessionOptions,
} from "../types"
import { DEFAULT_CODEX_COMMAND, MAX_CAPTURED_OUTPUT_LENGTH } from "../constants"
import { inspectCodexCapabilities } from "../capabilities/codex"

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

/**
 * Format TODO list
 */
function formatTodoList(item: Extract<ThreadItem, { type: "todo_list" }>) {
  return item.items
    .map((entry) => `${entry.completed ? "[x]" : "[ ]"} ${entry.text}`)
    .join("\n")
}

/**
 * Convert Codex ThreadItem to AgentEvent
 */
function convertThreadItemToEvent(
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

    default:
      return null
  }
}

/**
 * Codex agent adapter
 */
export class CodexAdapter implements IAgent {
  private readonly codex: Codex

  constructor() {
    this.codex = new Codex({
      codexPathOverride: DEFAULT_CODEX_COMMAND,
    })
  }

  getType(): string {
    return "codex"
  }

  async *startSessionAndRun(
    options: SessionOptions,
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const thread = this.codex.startThread(buildThreadOptions(options))
    yield* this.runStreamed(thread, prompt, signal)
  }

  async *resumeSessionAndRun(
    sessionId: string,
    options: SessionOptions,
    prompt: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentEvent> {
    const thread = this.codex.resumeThread(sessionId, buildThreadOptions(options))
    yield* this.runStreamed(thread, prompt, signal)
  }

  async getCapabilities(): Promise<AgentCapabilities> {
    return inspectCodexCapabilities()
  }

  private async *runStreamed(
    thread: Thread,
    prompt: string,
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
              content: prompt,
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

          // Handle command execution output
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

          // Convert other item types
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
