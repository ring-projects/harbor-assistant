# Agents Library

`apps/service/src/lib/agents` is Harbor's provider integration layer for external
coding agents.

Current supported providers:

- `codex`
- `claude-code`

This module is intentionally small. It owns runtime invocation, provider capability
declaration, and model catalog declaration. It does not own task lifecycle, event
projection, or UI-facing conversation shaping.

## Boundary

`lib/agents` is responsible for:

- starting a new provider session
- resuming an existing provider session
- mapping Harbor runtime options to provider-specific SDK options
- emitting provider-native raw events
- exposing Harbor-declared model and capability metadata
- registering runtimes and capability providers by `AgentType`

`lib/agents` is not responsible for:

- task creation, retry, follow-up, or archive workflows
- task event persistence
- normalized Harbor agent events
- UI message rendering
- business prompt summaries or display-only metadata
- raw event projection

If a responsibility needs task state, repository access, or UI-oriented event
shaping, it belongs outside this module.

## Current Design

The library is split into four parts:

1. `types.ts`
   Public contract for runtime input, runtime options, raw event envelopes, models,
   capabilities, and registry interfaces.

2. `adapters/`
   Provider-specific runtime implementations.

3. `capabilities/`
   Declared capability readers. These expose Harbor's current provider capability
   view. They do not perform dynamic environment probing.

4. `model-config.ts`
   Harbor-maintained source-code model catalog for providers that do not expose a
   stable machine-readable model list API.

## Public Contract

The current public contract is:

```ts
export type AgentType = "codex" | "claude-code"

export type AgentInputItem =
  | {
      type: "text"
      text: string
    }
  | {
      type: "local_image"
      path: string
    }

export type AgentInput = string | AgentInputItem[]

export type ReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh"

export type RuntimeReasoningEffort = Exclude<ReasoningEffort, "none">

export type AgentRuntimeOptions = {
  workingDirectory: string
  modelId?: string
  effort?: RuntimeReasoningEffort
  env?: Record<string, string>
  sandboxMode?: "read-only" | "workspace-write" | "danger-full-access"
  approvalPolicy?: "never" | "on-request" | "untrusted"
  networkAccessEnabled?: boolean
  webSearchMode?: "disabled" | "cached" | "live"
  additionalDirectories?: string[]
}

export type RawAgentEventEnvelope = {
  agentType: AgentType
  event: unknown
  createdAt: Date
}

export type AgentModel = {
  id: string
  name: string
  isDefault: boolean
  efforts: ReasoningEffort[]
}

export type AgentCapabilities = {
  models: AgentModel[]
  supportsResume: boolean
  supportsStreaming: boolean
}

export type AgentCapabilityResult = {
  checkedAt: Date
  agents: Record<AgentType, AgentCapabilities>
}

export interface IAgentRuntime {
  readonly type: AgentType

  startSessionAndRun(
    options: AgentRuntimeOptions,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope>

  resumeSessionAndRun(
    sessionId: string,
    options: AgentRuntimeOptions,
    input: AgentInput,
    signal?: AbortSignal,
  ): AsyncIterable<RawAgentEventEnvelope>
}

export interface IAgentCapabilityProvider {
  readonly type: AgentType

  inspect(): Promise<AgentCapabilities>
}

export type AgentRegistration = {
  type: AgentType
  runtime: IAgentRuntime
  capability: IAgentCapabilityProvider
}

export interface IAgentRegistry {
  has(type: AgentType): boolean
  get(type: AgentType): AgentRegistration
  getRuntime(type: AgentType): IAgentRuntime
  getCapability(type: AgentType): IAgentCapabilityProvider
  list(): AgentRegistration[]
  listTypes(): AgentType[]
  inspectAll(): Promise<AgentCapabilityResult>
}
```

## Raw Event Rule

The most important rule in this module is:

`adapters emit provider-native raw events`

That means:

- the adapter output is always `AsyncIterable<RawAgentEventEnvelope>`
- `event` should preserve the provider's original event body as much as possible
- adapters should not project provider events into Harbor task events
- adapters should not synthesize Harbor-specific UI events

If Harbor needs normalized task events, storage normalization, or lifecycle
completion, that work belongs outside `lib/agents`.

## Capability Semantics

Capabilities in this module are intentionally narrow.

Current capability surface:

- `models`
- `supportsResume`
- `supportsStreaming`

This shape is deliberate. The capability API is primarily used to expose model
choices and a small amount of runtime behavior that affects task execution flow.

Capabilities in this module are:

- Harbor-declared
- provider-specific
- stable enough for UI and task validation

Capabilities in this module are not:

- dynamic installation checks
- runtime health checks
- authoritative provider-wide discovery results

## Model Catalog

Model definitions live in `model-config.ts`.

These model lists are Harbor-maintained source-code configuration. They are used
because current providers do not expose a stable machine-readable model catalog API
that Harbor can rely on.

Important semantics:

- the model catalog is a curated candidate set
- it is not a provider-authoritative real-time inventory
- runtime execution remains the final source of truth
- model validation in higher layers may use this catalog to constrain allowed values

Current `codex` catalog includes:

- `gpt-5.3-codex`
- `gpt-5.4`
- `gpt-5.2-codex`
- `gpt-5.1-codex-max`
- `gpt-5.2`
- `gpt-5.1-codex-mini`

Current `claude-code` catalog includes:

- `claude-sonnet-4-6`
- `claude-opus-4-6`

## Runtime Notes

### Codex

`codex` integrates through the Codex SDK.

Current behavior:

- Harbor runtime options are mapped in `adapters/codex/options.ts`
- execution is performed through `Codex.startThread()` / `resumeThread()`
- SDK `ThreadEvent` values are emitted directly as raw envelopes

### Claude Code

`claude-code` integrates through the Claude Agent SDK.

Current behavior:

- Harbor runtime options are mapped in `adapters/claude-code/options.ts`
- structured Harbor input is serialized to a string prompt when required by the SDK
- SDK message values are emitted directly as raw envelopes

The local `sdk.js` / `sdk.d.ts` wrapper exists because the upstream package types are
not clean enough to consume directly in the current codebase.

## Registry

`AgentFactory` is the registry entrypoint for this module.

It binds each `AgentType` to:

- one runtime implementation
- one capability provider

This keeps runtime execution and capability declaration separate, while still using
one stable lookup key.

## Exports

The stable public module exports are:

- core types from `types.ts`
- `AgentFactory`
- `codexAdapter`
- `claudeCodeAdapter`
- `getAgentCapabilities`
- `getCodexCapabilities`
- `getClaudeCodeCapabilities`
- `AGENT_MODEL_CONFIG`
- `getConfiguredAgentModels`

## Testing Expectations

Tests in this module should focus on:

- provider option mapping
- raw event envelope shape
- runtime injection boundaries
- declared capability output
- registry registration behavior

Tests in this module should not depend on:

- task projection
- persistence
- UI rendering
- provider-wide live discovery

## Non-Goals

This module must not become:

- a task orchestration service
- a projection layer
- a persistence layer
- a prompt policy engine
- a UI formatting layer
- a generic diagnostics framework

If a new requirement needs domain state or read-model awareness, it should live
outside `lib/agents`.
