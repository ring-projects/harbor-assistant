# Harbor Task Event Storage Model

## 1. Status

- Date: 2026-03-20
- Status: Accepted
- Scope: `apps/service`, `apps/web`, task event storage and query projection

## 2. Decision

Harbor task events must store the **agent raw event stream** as the source of truth.

Harbor must **not** persist only a normalized cross-agent event model as its primary stored representation.

Normalized task events, chat blocks, timeline blocks, and any UI-oriented shapes must be produced at **query time** through projectors/mappers.

## 3. Why

Harbor needs to support more than one agent runtime, including at least:

- Codex
- Claude Code

These runtimes do not share the same raw protocol.

If Harbor persists only a normalized event shape:

- upstream protocol details are lost
- agent-specific metadata is flattened or discarded
- new upstream event types become hard to support
- projector logic becomes irreversible for historical data
- UI evolution forces storage/schema changes

If Harbor persists raw events first:

- compatibility with multiple agents is higher
- new event types can be added without rewriting old rows
- UI can evolve independently from storage
- different read models can be built from the same event history

## 4. Principles

### 4.1 Source Of Truth

The database must store the raw event envelope received from the agent adapter.

This stored event is the canonical historical record.

### 4.2 Projection At Read Time

The service query layer is responsible for transforming raw events into:

- normalized task events
- chat conversation blocks
- tool activity blocks
- debug timelines

### 4.3 Storage And UI Must Be Decoupled

`ChatConversationBlock` is a UI read model.

It must never be treated as the persistence model.

Likewise, any unified `AgentEvent` shape used for convenience inside a service boundary must not be assumed to be the permanent database format unless it is explicitly defined as the raw stored envelope.

### 4.4 Preserve Agent Identity

Each stored event must preserve which runtime produced it.

At minimum Harbor needs to distinguish:

- `codex`
- `claude-code`

## 5. Recommended Event Layers

Harbor should treat task events as a layered model:

1. `RawAgentEvent`
   - persisted
   - source of truth
   - agent-specific

2. `NormalizedTaskEvent`
   - optional
   - created by projector/mapping logic
   - used by service queries when a unified stream is required

3. `ChatConversationBlock`
   - frontend-facing view model
   - generated from normalized events or directly from raw events through a projection pipeline

## 6. Stored Event Shape

The stored task event envelope should preserve raw semantics and enough metadata to support future projections.

Recommended fields:

- `taskId`
- `sequence`
- `agentType`
- `rawEventType`
- `rawPayload`
- `createdAt`
- `externalId` optional
- `schemaVersion` optional

Notes:

- `rawEventType` should preserve upstream naming such as `thread.started`, `item.completed`, or the equivalent Claude raw event type.
- `rawPayload` should preserve the original event body as much as possible.
- `externalId` can store item identifiers such as command id, search id, tool call id, or message id when available.

## 7. Query Model

The query layer should expose projections instead of exposing the raw store directly by default.

Recommended read paths:

1. Raw events query
   - returns stored raw events with no semantic rewriting
   - useful for debugging, audits, and adapter validation

2. Normalized task events query
   - returns a unified Harbor event stream when the UI needs a stable shape

3. Chat projection query
   - returns chat-oriented blocks optimized for rendering

## 8. Chat UI Implications

The chat frontend should continue to consume projected display models rather than raw protocol events.

Examples:

- raw Codex `item.started` + `web_search` item
  -> projected `web-search` block

- raw Codex `item.completed` + `mcp_tool_call` item
  -> projected `mcp-tool-call` block

- raw Claude tool-use events
  -> projected tool call / command / event blocks as appropriate

This keeps the UI stable even when upstream agent protocols differ.

## 9. Current Direction

Harbor should move toward this rule:

- persist raw events
- project at query time
- render projected view models in the frontend

Because the system is still in active development, historical event rows can be deleted during implementation rather than migrated.

## 10. Non-Goals

This decision does not require:

- immediate event-sourcing infrastructure
- materialized views on day one
- preserving the current normalized event schema as the storage contract

The priority is to establish the correct boundary between:

- storage
- projection
- UI rendering
