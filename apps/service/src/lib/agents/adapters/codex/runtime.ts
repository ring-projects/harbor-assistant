import {
  Codex,
  type Thread as CodexThread,
  type ThreadEvent,
  type ThreadOptions as CodexThreadOptions,
} from "@openai/codex-sdk"

import type {
  AgentRuntimeOptions,
  AgentInput,
  IAgentRuntime,
  RawAgentEventEnvelope,
} from "../../types"
import { buildCodexProcessEnv, buildCodexThreadOptions } from "./options"
import { serializeHarborInputForCodex } from "./shared"

type Thread = Pick<CodexThread, "runStreamed">

type CreateCodexClient = (args: { env: Record<string, string> }) => {
  startThread: (options: ReturnType<typeof buildCodexThreadOptions>) => Thread
  resumeThread: (
    sessionId: string,
    options: ReturnType<typeof buildCodexThreadOptions>,
  ) => Thread
}

function createSdkCodexClient(args: { env: Record<string, string> }) {
  const codex = new Codex({
    env: args.env,
  })

  return {
    startThread: (options: CodexThreadOptions) => codex.startThread(options),
    resumeThread: (sessionId: string, options: CodexThreadOptions) =>
      codex.resumeThread(sessionId, options),
  }
}

export class CodexAdapter implements IAgentRuntime {
  readonly type = "codex" as const

  constructor(
    private readonly createCodexClient: CreateCodexClient = createSdkCodexClient,
  ) {}

  async *startSessionAndRun(
    options: AgentRuntimeOptions,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope> {
    const thread = this.createCodexClient({
      env: buildCodexProcessEnv(options.env),
    }).startThread(buildCodexThreadOptions(options))
    yield* this.runStreamed(thread, input, signal)
  }

  async *resumeSessionAndRun(
    sessionId: string,
    options: AgentRuntimeOptions,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope> {
    const thread = this.createCodexClient({
      env: buildCodexProcessEnv(options.env),
    }).resumeThread(sessionId, buildCodexThreadOptions(options))
    yield* this.runStreamed(thread, input, signal)
  }

  private async *runStreamed(
    thread: Thread,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope> {
    const { events } = await thread.runStreamed(
      serializeHarborInputForCodex(input),
      { signal },
    )

    for await (const event of events as AsyncIterable<ThreadEvent>) {
      yield {
        agentType: "codex",
        event,
        createdAt: new Date(),
      }
    }
  }
}

export const codexAdapter = new CodexAdapter()
