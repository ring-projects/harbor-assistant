import { randomUUID } from "node:crypto"
import path from "node:path"

import type {
  AgentInput,
  AgentRuntimeOptions,
  IAgentRuntime,
  RawAgentEventEnvelope,
} from "../../../../lib/agents"
import type {
  SandboxCommandHandle,
  SandboxProvisioningPort,
} from "../../../sandbox"
import { DOCKER_SANDBOX_REPO_ROOT } from "../../../sandbox"
import type {
  SandboxCodexRunnerEnvelope,
  SandboxCodexRunnerPayload,
} from "./sandbox-codex-protocol"

const RUNNER_PAYLOAD_DIRECTORY = ".harbor/runtime/codex-sandbox-runner"
const CONTAINER_SERVICE_ROOT = `${DOCKER_SANDBOX_REPO_ROOT}/apps/service`

function encodePayload(payload: SandboxCodexRunnerPayload) {
  return new TextEncoder().encode(JSON.stringify(payload))
}

function buildRunnerCommand() {
  return [
    `if [ -f "${CONTAINER_SERVICE_ROOT}/dist/modules/task/infrastructure/runtime/codex-sandbox-runner.js" ]; then`,
    `  exec node "${CONTAINER_SERVICE_ROOT}/dist/modules/task/infrastructure/runtime/codex-sandbox-runner.js"`,
    "fi",
    `cd "${CONTAINER_SERVICE_ROOT}"`,
    'exec node --import tsx "src/modules/task/infrastructure/runtime/codex-sandbox-runner.ts"',
  ].join("\n")
}

function readRunnerEnvelope(line: string) {
  try {
    return JSON.parse(line) as SandboxCodexRunnerEnvelope
  } catch {
    return null
  }
}

export class SandboxBackedCodexRuntime implements IAgentRuntime {
  readonly type = "codex" as const

  constructor(
    private readonly provider: SandboxProvisioningPort,
    private readonly providerSandboxId: string,
    private readonly sandboxWorkingDirectory: string,
  ) {}

  async *startSessionAndRun(
    options: AgentRuntimeOptions,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope> {
    yield* this.runInSandbox({
      sessionId: null,
      options,
      input,
      signal,
    })
  }

  async *resumeSessionAndRun(
    sessionId: string,
    options: AgentRuntimeOptions,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope> {
    yield* this.runInSandbox({
      sessionId,
      options,
      input,
      signal,
    })
  }

  private async *runInSandbox(input: {
    sessionId: string | null
    options: AgentRuntimeOptions
    input: AgentInput
    signal?: AbortSignal
  }): AsyncIterable<RawAgentEventEnvelope> {
    const payloadId = randomUUID()
    const relativePayloadPath = `${RUNNER_PAYLOAD_DIRECTORY}/${payloadId}.json`
    const sandboxPayloadPath = path.join(
      this.sandboxWorkingDirectory,
      relativePayloadPath,
    )

    await this.provider.writeFiles(this.providerSandboxId, [
      {
        path: relativePayloadPath,
        content: encodePayload({
          sessionId: input.sessionId,
          options: input.options,
          input: input.input,
        }),
      },
    ])

    const command = await this.provider.runCommand({
      providerSandboxId: this.providerSandboxId,
      command: buildRunnerCommand(),
      env: {
        HARBOR_CODEX_RUNNER_PAYLOAD_PATH: sandboxPayloadPath,
      },
    })
    const handle = await this.provider.getCommand({
      providerSandboxId: this.providerSandboxId,
      providerCommandId: command.providerCommandId,
    })
    if (!handle) {
      throw new Error(
        `Sandbox command handle was not found: ${command.providerCommandId}`,
      )
    }

    yield* this.consumeHandle(handle, input.signal)
  }

  private async *consumeHandle(
    handle: SandboxCommandHandle,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope> {
    const diagnosticLines: string[] = []
    let terminalError: string | null = null

    const abortListener = () => {
      void handle.kill()
    }

    if (signal) {
      if (signal.aborted) {
        abortListener()
      } else {
        signal.addEventListener("abort", abortListener, { once: true })
      }
    }

    try {
      for await (const line of handle.logs()) {
        const envelope = readRunnerEnvelope(line)
        if (!envelope) {
          diagnosticLines.push(line)
          continue
        }

        if (envelope.kind === "error") {
          terminalError =
            envelope.message.trim() || "Sandbox Codex runner failed."
          continue
        }

        yield {
          agentType: "codex",
          event: envelope.event,
          createdAt: new Date(envelope.createdAt),
        }
      }

      const result = await handle.wait()
      if (signal?.aborted) {
        throw new Error(
          typeof signal.reason === "string" && signal.reason.trim()
            ? signal.reason
            : "Sandbox Codex task aborted.",
        )
      }

      if (terminalError) {
        throw new Error(terminalError)
      }

      if (result.exitCode !== 0) {
        throw new Error(
          diagnosticLines.join("\n").trim() ||
            `Sandbox Codex runner exited with code ${result.exitCode ?? "unknown"}.`,
        )
      }
    } finally {
      if (signal) {
        signal.removeEventListener("abort", abortListener)
      }
    }
  }
}
