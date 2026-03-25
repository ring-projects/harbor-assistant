import { describe, expect, it } from "vitest"

import type {
  AgentCapabilities,
  AgentInput,
  AgentRuntimeOptions,
  IAgentCapabilityProvider,
  IAgentRuntime,
  RawAgentEventEnvelope,
} from "./types"
import { AgentFactory } from "./factory"

function createRuntime(type: IAgentRuntime["type"]): IAgentRuntime {
  return {
    type,
    async *startSessionAndRun(
      _options: AgentRuntimeOptions,
      _input: AgentInput,
      _signal?: AbortSignal,
    ): AsyncIterable<RawAgentEventEnvelope> {
      return
    },
    async *resumeSessionAndRun(
      _sessionId: string,
      _options: AgentRuntimeOptions,
      _input: AgentInput,
      _signal?: AbortSignal,
    ): AsyncIterable<RawAgentEventEnvelope> {
      return
    },
  }
}

function createCapability(
  type: IAgentCapabilityProvider["type"],
  overrides?: Partial<AgentCapabilities>,
): IAgentCapabilityProvider {
  return {
    type,
    async inspect() {
      return {
        models: [],
        supportsResume: true,
        supportsStreaming: true,
        ...overrides,
      }
    },
  }
}

describe("AgentFactory", () => {
  it("registers runtimes and capabilities and resolves them by type", () => {
    const codexRuntime = createRuntime("codex")
    const claudeCodeRuntime = createRuntime("claude-code")
    const codexCapability = createCapability("codex")
    const claudeCodeCapability = createCapability("claude-code")

    const registry = new AgentFactory([
      {
        type: "codex",
        runtime: codexRuntime,
        capability: codexCapability,
      },
      {
        type: "claude-code",
        runtime: claudeCodeRuntime,
        capability: claudeCodeCapability,
      },
    ])

    expect(registry.has("codex")).toBe(true)
    expect(registry.has("claude-code")).toBe(true)
    expect(registry.get("codex")).toEqual({
      type: "codex",
      runtime: codexRuntime,
      capability: codexCapability,
    })
    expect(registry.getRuntime("codex")).toBe(codexRuntime)
    expect(registry.getRuntime("claude-code")).toBe(claudeCodeRuntime)
    expect(registry.getCapability("codex")).toBe(codexCapability)
    expect(registry.getCapability("claude-code")).toBe(claudeCodeCapability)
    expect(registry.listTypes()).toEqual(["codex", "claude-code"])
    expect(registry.list()).toEqual([
      {
        type: "codex",
        runtime: codexRuntime,
        capability: codexCapability,
      },
      {
        type: "claude-code",
        runtime: claudeCodeRuntime,
        capability: claudeCodeCapability,
      },
    ])
  })

  it("throws when a runtime type does not match its registration type", () => {
    expect(
      () =>
        new AgentFactory([
          {
            type: "claude-code",
            runtime: createRuntime("codex"),
            capability: createCapability("claude-code"),
          },
        ]),
    ).toThrowError(/runtime type mismatch/i)
  })

  it("throws when a capability type does not match its registration type", () => {
    expect(
      () =>
        new AgentFactory([
          {
            type: "codex",
            runtime: createRuntime("codex"),
            capability: createCapability("claude-code"),
          },
        ]),
    ).toThrowError(/capability type mismatch/i)
  })

  it("throws when the same agent type is registered more than once", () => {
    const codexRuntime = createRuntime("codex")

    expect(
      () =>
        new AgentFactory([
          {
            type: "codex",
            runtime: codexRuntime,
            capability: createCapability("codex"),
          },
          {
            type: "codex",
            runtime: createRuntime("codex"),
            capability: createCapability("codex"),
          },
        ]),
    ).toThrowError(/duplicate agent registration/i)
  })

  it("throws when resolving an unknown runtime", () => {
    const registry = new AgentFactory([
      {
        type: "codex",
        runtime: createRuntime("codex"),
        capability: createCapability("codex"),
      },
    ])

    expect(registry.has("claude-code")).toBe(false)
    expect(() => registry.getRuntime("claude-code")).toThrowError(
      /unknown agent type/i,
    )
    expect(() => registry.getCapability("claude-code")).toThrowError(
      /unknown agent type/i,
    )
  })

  it("inspects all registered capabilities through the registry", async () => {
    const registry = new AgentFactory([
      {
        type: "codex",
        runtime: createRuntime("codex"),
        capability: createCapability("codex"),
      },
      {
        type: "claude-code",
        runtime: createRuntime("claude-code"),
        capability: createCapability("claude-code", {
          supportsResume: false,
          supportsStreaming: false,
        }),
      },
    ])

    const result = await registry.inspectAll()

    expect(result.checkedAt).toBeInstanceOf(Date)
    expect(result.agents.codex).toEqual(
      expect.objectContaining({
        supportsResume: true,
        supportsStreaming: true,
      }),
    )
    expect(result.agents["claude-code"]).toEqual(
      expect.objectContaining({
        supportsResume: false,
        supportsStreaming: false,
      }),
    )
  })
})
