# Harbor Service `spawn EBADF` RCA

Date: 2026-03-18
Scope: `apps/service`
Status: Fixed in code, follow-up prevention actions listed below

## Summary

Harbor service intermittently failed to execute child processes with:

```text
Error: spawn EBADF
```

The visible symptoms were:

- Git APIs such as `/v1/projects/:id/git/diff` returning `500`
- Codex-related process launches failing in the same service process
- Repeated failures after the first error, without restarting the process

This was not a Git repository issue and not a Codex SDK issue by itself. The direct cause was that the Harbor service process accumulated an abnormal number of file watchers, which pushed the process into a bad runtime state where `child_process.spawn()` started failing synchronously.

## Impact

- Git repository introspection became unavailable for affected projects
- Codex and other child-process-backed integrations became unreliable because they share the same `spawn()` mechanism
- Errors looked unrelated at first because they surfaced through different modules

## Symptoms

Representative logs:

```text
Failed to resolve git repository root for /Users/qiuhao/workspace/harbor-assistant: spawn EBADF
```

Structured diagnostics from the failing process showed:

- `pid` remained the same across repeated failures
- `uptimeSeconds` was low, but `activeHandles.total` was already very high
- `activeHandles.counts.FSWatcher` reached `11089`
- `stdio` file descriptors `0/1/2` were still healthy
- `activeRequests.total` was `0`

This ruled out several earlier guesses:

- not a missing Git binary
- not a broken stdin/stdout/stderr
- not a normal `EMFILE`-style "too many open files" failure
- not a repository path validation problem

## Root Cause

### 1. The service created a project git watcher for realtime subscriptions

The watcher is created when task routes are registered:

- `apps/service/src/modules/tasks/routes/index.ts`

That watcher is then used by the socket gateway when clients subscribe to project git updates:

- `apps/service/src/modules/tasks/realtime/task-socket.gateway.ts`

### 2. The old implementation watched the entire project tree recursively via `chokidar`

Before the fix, `createProjectGitWatcher()` used `chokidar.watch(...)` on:

- the whole project path
- `.git/HEAD`
- `.git/index`

That implementation lived in:

- `apps/service/src/modules/git/services/project-git-watcher.service.ts`

Although the code only called `watch(project.path)` once, `chokidar` recursively expanded that into a very large number of underlying watchers across the project tree.

For a repository the size of `harbor-assistant`, this was enough to create roughly the same order of magnitude as the total file count outside `.git` and `node_modules`.

### 3. Once the process accumulated too many watchers, `spawn()` became unreliable

Git commands in the service run through:

- `apps/service/src/modules/git/repositories/git.repository.ts`

The failure occurred here:

```ts
spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"], ... })
```

At that point the error was synchronous, so the child process never successfully started.

This explains why multiple features failed at the same time:

- Git routes failed because they spawn `git`
- Codex-related flows failed because they also rely on child processes

The common failing primitive was `child_process.spawn()`.

## Why It Was Misleading At First

Several side issues made diagnosis slower:

### Git diff misreported one class of failures

`readProjectGitDiff()` previously performed a repository pre-check and treated any non-zero result as "Project path is not a git repository."

That logic masked lower-level spawn failures as repository errors.

This was fixed by removing the redundant pre-check in:

- `apps/service/src/modules/git/services/git-diff.service.ts`

### Dev logging was a distraction, not the root cause

`pino-pretty` was removed from the Fastify dev logger configuration because it added extra runtime complexity and process interactions during diagnosis.

That change reduced noise, but it was not the primary root cause.

## Fixes Implemented

### 1. Replaced recursive `chokidar` watcher usage with native `fs.watch`

`project-git-watcher.service.ts` now uses native recursive file watching:

- `apps/service/src/modules/git/services/project-git-watcher.service.ts`

Key design change:

- stop depending on `chokidar` for project git realtime watching
- use `fs.watch(projectPath, { recursive: true })`
- keep filtering for `.git` and `node_modules`
- keep debounce behavior

### 2. Removed direct `chokidar` dependency from `apps/service`

Dependency removed from:

- `apps/service/package.json`

### 3. Added spawn diagnostics

New diagnostics were added to capture:

- `pid`, `ppid`, platform, node version, uptime
- state of stdio file descriptors
- active handles summary
- active requests summary
- selected environment variables

Implemented in:

- `apps/service/src/lib/process-env.ts`

And used by:

- `apps/service/src/modules/git/repositories/git.repository.ts`

### 4. Corrected Git diff error classification

Removed the repository pre-check that converted runtime failures into false repository errors:

- `apps/service/src/modules/git/services/git-diff.service.ts`

### 5. Simplified dev logger path

Removed `pino-pretty` transport from the Fastify development logger:

- `apps/service/src/app.ts`

## Validation

The following checks passed after the fix:

- `pnpm --dir apps/service typecheck`
- `pnpm --dir apps/service exec vitest run src/modules/git/services/project-git-watcher.service.test.ts src/modules/tasks/realtime/task-socket.gateway.test.ts src/modules/git/__tests__/git.routes.test.ts`

Additional git and Codex-related tests were also added or updated during the debugging process.

## Prevention Plan

### Immediate guardrails

1. Avoid recursive watcher libraries for large workspace roots unless there is a hard platform requirement.
2. Prefer native OS-backed recursive watch APIs when the platform supports them.
3. Keep watcher scope as narrow as possible. Watching the whole project tree for Git state changes should be treated as a last resort.

### Code-level follow-up

1. Add a lightweight runtime warning when `activeHandles.counts.FSWatcher` exceeds a threshold.
2. Expose watcher counts through a health/debug endpoint for incident diagnosis.
3. Consider narrowing the watcher target further to `.git` state only if product requirements allow it.

### Review policy

When introducing any filesystem watcher in `apps/service`, review the following explicitly:

1. What exact path is being watched?
2. Is the watch recursive?
3. How many watchers can this create for a large repository?
4. What is the unsubscribe and cleanup lifecycle?
5. Could the same product goal be met by polling or a narrower watch target?

## Final Conclusion

The real issue was not "Git is broken" and not "Codex SDK is broken." The Harbor service process was placing itself into an unstable state by creating an excessive number of file watchers through the project git realtime subscription path. Once that happened, `spawn()` became unreliable, and multiple higher-level features failed as a consequence.

The implemented fix removes the problematic watcher strategy from `apps/service`, improves diagnostics, and corrects misleading error classification so similar issues are easier to diagnose if they recur.
