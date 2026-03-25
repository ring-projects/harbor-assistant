# Product Requirements Document (PRD)

## Product

Harbor Assistant — Executor Service (TypeScript-first)

## Date

2026-03-05

## Author

qwer951123 + Codex Assistant

---

## 1. Executive Summary

Harbor Assistant already provides a usable project shell, project management, filesystem browsing, and basic task triggering from Next.js.  
The current task execution path directly spawns CLI processes inside the web/server layer, which is sufficient for early MVP but introduces scaling and reliability limits for long-running, concurrent, and observable agent jobs.

This PRD defines a TypeScript-first Executor Service that separates execution lifecycle concerns from the Next.js application while preserving the existing product UX and data model direction.

The target outcome is a production-ready task execution foundation with:

- durable task lifecycle state
- reliable cancellation/retry semantics
- real-time event streaming
- multi-executor adapter support (`codex`, `opencode`, `claude/claudcode`)
- clean integration boundary with the existing Next app as BFF/UI
- Prisma-based persistence that starts on SQLite and keeps PostgreSQL migration path simple

---

## 2. Problem Statement

### Current State

Current implementation includes:

- task trigger via server action
- process spawn for Codex execution
- JSON-file-backed task storage
- polling-based UI refresh

### Pain Points

1. **Lifecycle reliability gap**  
   Task runtime state is not managed by a dedicated orchestration component with explicit restart/recovery semantics.

2. **Storage limitations**  
   JSON store is simple but not ideal for queryability, concurrency, and auditability as volume grows.

3. **Observability limitations**  
   The current model captures stdout/stderr snapshots but lacks a first-class event stream for near-real-time UX and debugging.

4. **Architecture coupling**  
   Next server layer is handling both UI/BFF concerns and job execution concerns, increasing long-term complexity.

---

## 3. Product Vision

Build a robust local-first execution platform for Harbor where users can submit, observe, control, and trust AI task runs across multiple executor backends, while keeping the developer ergonomics and ecosystem advantages of TypeScript.

---

## 4. Goals and Non-Goals

### Goals

1. Introduce a dedicated Executor Service in TypeScript/Node.
2. Move task state from JSON to Prisma-managed SQLite durable schema.
3. Provide real-time task event streaming for UI.
4. Support a unified adapter interface for multiple executors.
5. Maintain backward-compatible UX for existing task creation flow.
6. Keep schema and repository design portable for future PostgreSQL adoption.

### Non-Goals (v1)

1. Multi-tenant SaaS isolation and cloud-scale tenancy.
2. Distributed queue orchestration across multiple hosts.
3. Full enterprise policy engine and compliance workflow automation.
4. Rich visual workflow builder for task DAG authoring.

---

## 5. Target Users

1. **Primary: Solo/power developer**
   - Works with multiple local repositories
   - Needs quick AI execution loop with reliable outputs

2. **Secondary: Small engineering team**
   - Needs consistent task records and debuggable execution traces
   - Wants to evaluate different executor runtimes under one UI

---

## 6. User Stories

1. As a developer, I can submit a task against a selected project and receive a task ID immediately.
2. As a developer, I can watch live task output and status transitions without manual full-page refresh.
3. As a developer, I can cancel a running task and see deterministic terminal state.
4. As a developer, I can retry a failed task with the same prompt/model and keep audit history.
5. As a developer, I can list historical tasks per project with filtering by status and time.
6. As a developer, I can inspect executor capability information before selecting runtime/model.

---

## 7. Scope (v1)

### In Scope

- Dedicated Executor Service (`TypeScript`, `Node.js`, HTTP API + SSE)
- Task lifecycle state machine
- Prisma schema + migrations for tasks, runs, and task events (`SQLite` in v1)
- Codex adapter as first production adapter
- Adapter abstraction prepared for OpenCode and Claude/ClaudCode
- Next app integration as BFF consumer of executor APIs

### Out of Scope

- Cross-machine distributed workers
- Complex scheduling (cron/workflow DAG)
- Team-level authorization matrix
- Billing/cost center management

---

## 8. Functional Requirements

### FR-001 Task Creation

System must expose a create-task API that validates:

- project identity and path
- prompt non-empty
- executor type
- optional model

On success, return task metadata and `queued` state.

### FR-002 Task Lifecycle State Machine

System must support at minimum:

- `queued`
- `running`
- `completed`
- `failed`
- `cancelled`

State transitions must be persisted and timestamped.

### FR-003 Execution Adapter Contract

System must define a typed adapter interface:

- start run
- stream events
- break current turn
- map raw exit/result to normalized status

### FR-004 Event Streaming

System must provide SSE endpoint for task run events including:

- state changes
- stdout chunks
- stderr chunks
- terminal summary

### FR-005 Break Current Turn

System must support breaking the current turn for `running` tasks with deterministic terminal state (`cancelled` or `failed` with break reason).

### FR-006 Retry

System must support retrying a failed/cancelled task as a new run while keeping linkage to original task.

### FR-007 Task Query APIs

System must provide:

- list tasks by project (paginated)
- get task detail
- get run detail
- get recent events

### FR-008 Next Integration Compatibility

Existing Next task creation UI path must continue working via BFF proxy/client update with minimal UX regression.

### FR-009 Capability Surface

System must provide executor capability endpoint with:

- installed/version status
- available models (if discoverable)
- diagnostics on probe failures

### FR-010 Auditability

System must persist command, parameters, timestamps, and terminal metadata for each run.

---

## 9. Non-Functional Requirements

### NFR-001 Reliability

- No silent task state loss on normal service restart.
- Task terminal states must be durable and queryable.

### NFR-002 Performance

- Task create API P95 latency under 300ms (excluding actual run time).
- Event delivery lag target under 1s in local environment.

### NFR-003 Scalability (local-first)

- Support at least 20 concurrent queued/running tasks per host for v1 target usage profile.

### NFR-004 Security

- Enforce path boundary checks before execution.
- Redact secret-like values from user-visible event streams by default.

### NFR-005 Maintainability

- Shared TypeScript contracts between Next app and Executor Service.
- Adapter implementations isolated by executor module boundaries.

### NFR-006 Observability

- Structured logs with task/run correlation IDs.
- Error classification and retry reason captured in persistent metadata.

---

## 10. Data Requirements

### Core Entities

1. **tasks**
   - logical task container (project, prompt, executor, created metadata)

2. **task_runs**
   - each execution attempt with status, start/end times, command metadata

3. **task_events**
   - ordered stream events (`stdout`, `stderr`, `state`, `system`)

### Persistence Technology Decision (v1)

- ORM: `Prisma`
- Primary database: `SQLite` (local-first default)
- Migration system: Prisma migration files committed into repository
- Data access boundary: repository/services consume Prisma Client, UI/BFF never directly touches SQL

### Future PostgreSQL Migration Requirement (v2+)

- Current schema design must avoid SQLite-only lock-in where possible (IDs, timestamps, event ordering strategy).
- Migration path should require only:
  1. `provider` switch to `postgresql`
  2. migration re-generation/application
  3. one-time data copy from SQLite to PostgreSQL
- Task/run/event API contracts and domain status semantics must remain unchanged across database engines.

### Migration Requirement

- System must provide one-time import utility from legacy `tasks.json` to Prisma/SQLite schema with idempotent behavior.

---

## 11. API Requirements (v1)

Minimum executor API surface:

- `POST /v1/tasks`
- `POST /v1/tasks/:taskId/break`
- `POST /v1/tasks/:taskId/retry`
- `GET /v1/projects/:projectId/tasks`
- `GET /v1/tasks/:taskId`
- `GET /v1/tasks/:taskId/events` (SSE)
- `GET /v1/executors/capabilities`

All APIs must return typed error codes suitable for UI branching.

---

## 12. UX Requirements

1. Task list must display status badge, created time, executor, model.
2. Task detail must show live output stream and final result summary.
3. Break action must provide immediate optimistic feedback and eventual terminal confirmation.
4. Failure view must include normalized reason and retry CTA.

---

## 13. Success Metrics

### Product Metrics

1. ≥ 95% of submitted tasks reach a terminal state (`completed|failed|cancelled`) without manual DB/file intervention.
2. Median time from task create to first visible output event < 2 seconds (local baseline).
3. ≥ 80% of failed tasks include actionable normalized error classification.

### Engineering Metrics

1. Zero JSON task-store writes in primary flow after migration complete.
2. Adapter contract test coverage for all enabled executors.
3. No blocker-level regressions in existing project management flows.

---

## 14. Risks and Mitigations

1. **Risk:** Executor CLI behavior differences cause inconsistent lifecycle mapping.  
   **Mitigation:** strict adapter abstraction + per-adapter contract tests.

2. **Risk:** Event volume impacts storage and UI rendering.  
   **Mitigation:** event chunking, retention policy, and paging for history.

3. **Risk:** Next and executor process boundaries increase integration complexity.  
   **Mitigation:** shared TS schema package and explicit API versioning.

4. **Risk:** Break semantics differ per runtime.  
   **Mitigation:** define normalized break policy and runtime-specific fallback behavior.

---

## 15. Release Plan

### Phase 1 — Storage and Contract Foundation

- Introduce Prisma schema and baseline migrations for task storage (SQLite)
- Add shared task/executor contract types
- Add one-time `tasks.json -> SQLite` importer with idempotent replay safety
- Keep current UI with compatibility layer

### Phase 2 — Executor Service Extraction

- Stand up dedicated TypeScript executor service
- Move spawn/runtime handling out of Next actions
- Integrate create/list/detail APIs

### Phase 3 — Streaming and Controls

- Add SSE live output stream
- Add cancel/retry endpoints and UI controls
- Add structured operational telemetry

### Phase 4 — Multi-Executor Expansion

- Add OpenCode adapter
- Add Claude/ClaudCode adapter
- Harden capability probing and model discovery behavior

### Phase 5 — PostgreSQL Readiness (Optional, post-v1)

- Validate Prisma schema portability on PostgreSQL
- Deliver SQLite -> PostgreSQL migration utility/runbook
- Run compatibility tests to confirm API/domain behavior parity

---

## 16. Open Questions

1. Should v1 keep task metadata in existing Harbor DB file hierarchy or split to a dedicated executor DB path?
2. What retention policy should apply to `task_events` (size/time)?
3. Is per-project concurrency cap configurable by user in v1 or fixed by default?
4. Should model allowlist/denylist policies be user-configurable in v1?
5. At what scale/signal should the default deployment recommendation switch from SQLite to PostgreSQL?

---

## 17. References

- [agent-runtime-integration.md](./agent-runtime-integration.md)
- [project-api.md](./project-api.md)
- [research/codex-mcp-config-research.md](./research/codex-mcp-config-research.md)
- historical planning artifact in `_bmad-output/planning-artifacts/research/technical-codex-sub-agent-in-service-research-2026-03-05.md` if present locally
