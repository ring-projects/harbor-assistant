import {
  query as createClaudeQuery,
  type ClaudeQuery,
  type ClaudeQueryOptions,
  type ClaudeSdkMessage,
} from "./sdk.js"
import type {
  AgentInput,
  AgentRuntimeOptions,
  IAgentRuntime,
  RawAgentEventEnvelope,
} from "../../types"
import { buildClaudeQueryOptions } from "./options"

type ClaudeQueryLike = AsyncIterable<ClaudeSdkMessage> & {
  close(): void
}

type CreateClaudeQuery = (args: {
  prompt: string
  options: ClaudeQueryOptions
}) => ClaudeQueryLike

function serializeAgentInput(input: AgentInput) {
  if (typeof input === "string") {
    return input
  }

  const text = input
    .flatMap((item) => (item.type === "text" ? [item.text.trim()] : []))
    .filter((item) => item.length > 0)
    .join("\n\n")
    .trim()
  const images = input
    .flatMap((item) =>
      item.type === "local_image" ? [`- ${item.path}`] : [],
    )
    .join("\n")

  if (!images) {
    return text
  }

  if (!text) {
    return `Attached local images:\n${images}`
  }

  return `${text}\n\nAttached local images:\n${images}`
}

function createRawEventEnvelope(args: {
  event: ClaudeSdkMessage
  createdAt?: Date
}): RawAgentEventEnvelope {
  return {
    agentType: "claude-code",
    event: args.event,
    createdAt: args.createdAt ?? new Date(),
  }
}

/**
 * Claude Code agent adapter
 */
export class ClaudeCodeAdapter implements IAgentRuntime {
  readonly type = "claude-code" as const

  constructor(
    private readonly createQuery: CreateClaudeQuery = ({ prompt, options }) =>
      createClaudeQuery({
        prompt,
        options,
      }) as ClaudeQuery,
  ) {}

  async *startSessionAndRun(
    options: AgentRuntimeOptions,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope> {
    const prompt = serializeAgentInput(input)
    const abortController = new AbortController()

    yield* this.runQuery(
      this.createQuery({
        prompt,
        options: buildClaudeQueryOptions({
          options,
          abortController,
        }),
      }),
      {
        signal,
        abortController,
      },
    )
  }

  async *resumeSessionAndRun(
    sessionId: string,
    options: AgentRuntimeOptions,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope> {
    const prompt = serializeAgentInput(input)
    const abortController = new AbortController()

    yield* this.runQuery(
      this.createQuery({
        prompt,
        options: buildClaudeQueryOptions({
          options,
          abortController,
          resumeSessionId: sessionId,
        }),
      }),
      {
        signal,
        abortController,
      },
    )
  }

  private async *runQuery(
    query: ClaudeQueryLike,
    args: {
      signal?: AbortSignal
      abortController: AbortController
    },
  ): AsyncIterable<RawAgentEventEnvelope> {
    let terminalError: string | null = null

    const abortListener = () => {
      terminalError =
        typeof args.signal?.reason === "string"
          ? args.signal.reason
          : "Claude Code task aborted."
      args.abortController.abort(args.signal?.reason)
      query.close()
    }

    if (args.signal) {
      if (args.signal.aborted) {
        abortListener()
      } else {
        args.signal.addEventListener("abort", abortListener, { once: true })
      }
    }

    try {
      for await (const message of query) {
        yield createRawEventEnvelope({
          event: message,
        })
      }
    } catch (error) {
      if (!terminalError) {
        terminalError = String(error)
      }
    } finally {
      if (args.signal) {
        args.signal.removeEventListener("abort", abortListener)
      }

      query.close()
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
