# Harbor Service Implementation Review

Date: 2026-03-08  
Scope: `apps/service` (HTTP routes, task runtime, repository/persistence, config, capability probe)

## Executive Summary

The current service implementation is already production-leaning in terms of typed request validation, modular route registration, and task lifecycle persistence with Prisma. However, there are several **high-risk correctness and reliability gaps** in task cancellation/output handling, path boundary enforcement, and persistence/config consistency.

**Review outcome:** Changes requested before considering the service lifecycle stable.

---

## Architecture Snapshot (Current State)

- Entrypoint + HTTP shell: `apps/service/src/server.ts`, `apps/service/src/app.ts`
- API routes: `apps/service/src/routes/v1/*`
- Domain modules:
  - Task lifecycle + execution: `apps/service/src/modules/tasks/*`
  - Project metadata: `apps/service/src/modules/project/repositories/project.repository.ts`
  - Filesystem browsing: `apps/service/src/modules/filesystem/services/filesystem.service.ts`
- Persistence:
  - Tasks/runs/events/messages via Prisma: `apps/service/src/modules/tasks/repositories/task.repository.ts`
  - Projects via Prisma: `apps/service/src/modules/project/repositories/project.repository.ts`

---

## Findings

### High Severity

1. **Path boundary is not enforced for project registration/execution**
   - Evidence: `apps/service/src/modules/project/repositories/project.repository.ts`
   - Problem: `resolveProjectPath` resolves and canonicalizes paths but does not enforce that the canonical path is inside configured root (`fileBrowser.rootDirectory`).
   - Impact: tasks can be executed against arbitrary directories if user provides absolute paths.
   - Recommendation: enforce root-boundary check (similar to filesystem module logic) before storing project path.

2. **Task cancellation race can end in `completed` after user cancellation**
   - Evidence: `apps/service/src/modules/tasks/services/task-runner.service.ts`
   - Problem: cancellation flag is only checked in `catch`; successful completion path always finalizes as `completed`.
   - Impact: non-deterministic task state and broken cancel semantics.
   - Recommendation: introduce terminal-state guard/compare-and-set so only first terminal transition wins, and check cancellation flag before marking completed.

3. **Failure path drops runtime output (debug signal loss)**
   - Evidence: `apps/service/src/modules/tasks/services/task-runner.service.ts`
   - Problem: both failure handlers persist `stdout/stderr` as empty strings even when output had been captured before failure.
   - Impact: postmortem/debugging quality is significantly reduced; user sees less actionable failure context.
   - Recommendation: propagate partial buffers in error path (e.g., typed gateway error carrying captured stdout/stderr).

4. **`stderr` stream is effectively not implemented**
   - Evidence: `apps/service/src/modules/tasks/gateways/agent.gateway.ts`
   - Problem: gateway only appends `stdout` events and always returns `stderr: ""`.
   - Impact: does not satisfy lifecycle observability expectations for error output.
   - Recommendation: capture stderr-equivalent events from SDK and persist as `stderr` task events + summary payload.

5. **Task DB config fallback should stay aligned with the service config model**
   - Evidence: historical review note; Prisma access is now centralized through the Fastify plugin
   - Problem: this review item referred to a now-removed YAML config layer; the remaining concern is to keep all runtime configuration sourced from the same service config model.
   - Impact: configuration drift is still possible if new ad hoc config sources are introduced.
   - Recommendation: keep runtime config centralized in `src/config.ts`.

### Medium Severity

6. **Event/message sequence generation is race-prone under concurrent writes**
   - Evidence: `apps/service/src/modules/tasks/repositories/task.repository.ts`
   - Problem: sequence is generated via `MAX(sequence) + 1`; concurrent transactions can produce duplicate sequence values.
   - Impact: intermittent unique-key failures (`runId+sequence`) under cancel/stream overlap or future multi-writer scenarios.
   - Recommendation: move sequence increment to a single atomic counter or add retry-on-conflict strategy.

7. **Pagination limits are not capped on task endpoints**
   - Evidence: `apps/service/src/modules/tasks/routes/tasks.routes.ts`, `apps/service/src/modules/tasks/repositories/task.repository.ts`
   - Problem: `limit` is validated as positive but has no upper bound.
   - Impact: large requests can create heavy DB/memory pressure.
   - Recommendation: enforce global caps (e.g., events 500, tasks/messages 200) at route layer.

8. **Persistence stack is split across Prisma and direct Bun SQLite**
   - Evidence: historical review note
   - Problem: this finding has been partially addressed; project metadata has already been migrated to Prisma.
   - Impact: lower than at review time.
   - Recommendation: keep repository boundaries consistent across modules.

### Low Severity

9. **CORS is fully open by default**
   - Evidence: `apps/service/src/app.ts:20`
   - Problem: `origin: true` reflects permissive CORS behavior.
   - Impact: local-first setups are usually fine, but this is risky if service is exposed beyond localhost/trusted network.
   - Recommendation: add configurable allowlist and environment-sensitive defaults.

10. **No automated tests for critical lifecycle paths**
    - Evidence: no test files under `apps/service` (`rg --files apps/service | rg -i "test|spec"` returns none)
    - Problem: core flows (cancel/retry/followup/event stream) are unguarded by regression tests.
    - Impact: high chance of lifecycle regressions during ongoing refactors.
    - Recommendation: add focused tests for task state transitions and repository event sequencing.

---

## What Is Good

- Route-level payload validation is progressively moving to Fastify schema declarations.
- Task domain separation is clearer after module split (`services/`, `repositories/`, `gateways/`).
- SSE route design supports both polling JSON and stream mode (`apps/service/src/modules/tasks/routes/tasks.routes.ts`).
- Prisma schema for task lineage/thread/message entities is reasonably extensible (`apps/service/prisma/schema.prisma`).

---

## Prioritized Remediation Plan

### P0 (Do immediately)

1. Fix cancellation terminal-state race and ensure status monotonicity.
2. Preserve partial output in failure paths and implement stderr capture.
3. Enforce project path root boundary checks before persistence/execution.

### P1 (Next sprint)

4. Replace `MAX+1` sequence allocation with conflict-safe strategy.
5. Add route-level max limits for list/events/conversation endpoints.
6. Keep Prisma/database configuration centralized in `src/config.ts`.

### P2 (Stabilization)

7. Consolidate project/task persistence strategy.
8. Add lifecycle regression tests (create → running → cancel/complete/fail/retry/followup).

---

## Verification Notes

- Typecheck status: passed (`bun run --cwd apps/service typecheck`).
- Review mode: static code review of service implementation and current repository state (no behavior changes applied in this document).
