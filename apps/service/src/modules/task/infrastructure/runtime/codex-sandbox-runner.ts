import { readFile } from "node:fs/promises"

import { Codex, type ThreadEvent } from "@openai/codex-sdk"

import {
  buildCodexProcessEnv,
  buildCodexThreadOptions,
} from "../../../../lib/agents/adapters/codex/options"
import { serializeHarborInputForCodex } from "../../../../lib/agents/adapters/codex/shared"
import type {
  SandboxCodexRunnerEnvelope,
  SandboxCodexRunnerPayload,
} from "./sandbox-codex-protocol"

function emitEnvelope(envelope: SandboxCodexRunnerEnvelope) {
  process.stdout.write(`${JSON.stringify(envelope)}\n`)
}

async function loadPayload() {
  const payloadPath = process.env.HARBOR_CODEX_RUNNER_PAYLOAD_PATH?.trim()
  if (!payloadPath) {
    throw new Error("Missing HARBOR_CODEX_RUNNER_PAYLOAD_PATH.")
  }

  const raw = await readFile(payloadPath, "utf8")
  return JSON.parse(raw) as SandboxCodexRunnerPayload
}

async function run() {
  try {
    const payload = await loadPayload()
    const codex = new Codex({
      env: buildCodexProcessEnv(payload.options.env),
    })
    const thread = payload.sessionId
      ? codex.resumeThread(
          payload.sessionId,
          buildCodexThreadOptions(payload.options),
        )
      : codex.startThread(buildCodexThreadOptions(payload.options))
    const { events } = await thread.runStreamed(
      serializeHarborInputForCodex(payload.input),
    )

    for await (const event of events as AsyncIterable<ThreadEvent>) {
      emitEnvelope({
        kind: "event",
        createdAt: new Date().toISOString(),
        event,
      })
    }
  } catch (error) {
    emitEnvelope({
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    })
    process.exitCode = 1
  }
}

void run()
