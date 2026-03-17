# Frontend Testing Guide

## Current Stack

The web app uses:

- `Vitest` for the test runner
- `jsdom` for browser-like unit and hook tests
- `@testing-library/react` for component and hook behavior tests
- `@testing-library/jest-dom` for DOM assertions

Run tests with:

```bash
pnpm run test:web
```

Inside `apps/web`:

```bash
pnpm test
pnpm test:watch
```

## What To Test

Prioritize tests in this order:

1. Pure functions and mappers
2. State transitions in stores and reducers
3. Hooks with meaningful behavior
4. UI behavior that users can trigger and observe
5. Critical end-to-end flows

## Unit Tests

Use unit tests for code with clear inputs and outputs:

- formatters
- mappers
- parsers
- validation logic
- status-to-label conversion
- file-extension or language inference

Good unit tests are:

- fast
- deterministic
- narrow in scope
- easy to debug

In this repo, good early targets include:

- `src/components/code/utils.ts`
- `src/modules/chat/mappers/to-conversation-blocks.ts`
- `src/lib/utils.ts`

## Store And Hook Tests

Test stores and hooks when they contain behavior, not just wiring.

Examples:

- Zustand state transitions
- viewport and media-query driven hooks
- data transformation inside custom hooks
- retry, polling, or cache update behavior

In this repo, good examples are:

- `src/stores/ui.store.ts`
- `src/hooks/use-mobile.ts`
- React Query hooks that update cache on success

## Component Tests

Component tests should focus on behavior visible to the user:

- rendering the right content
- reacting to clicks and keyboard input
- showing loading, empty, and error states
- calling callback props correctly
- preserving accessibility semantics

Avoid testing:

- private implementation details
- exact internal state shape
- fragile DOM structure that users do not care about
- style classes unless they carry real behavior or state

Good component test examples:

- the project creation modal submits valid data
- a task panel renders loading, success, and error states
- a chat block renders stdout and stderr differently

## API And Data Boundary Tests

Frontend bugs often appear at boundaries, not in buttons.

Test:

- fetch response parsing
- error normalization
- cache updates after mutations
- fallback behavior for empty or malformed payloads

For this repo, high-value targets include:

- `src/modules/projects/hooks/use-projects.ts`
- `src/modules/tasks/api/task-api-client.ts`

These tests usually mock `fetch` and assert:

- request method and payload
- successful parsed output
- failure handling and error messages

## End-To-End Tests

Add E2E tests only for critical user journeys. They are slower and cost more to maintain.

Good E2E targets:

- open app and land on the correct workspace
- create a project
- start a task
- inspect conversation events and diff results
- retry or cancel a task

Do not use E2E tests to cover every edge case. Keep them for smoke coverage of core flows.

## Coverage Priorities

Before trying to maximize line coverage, make sure these scenarios are covered:

- happy path
- empty state
- error state
- loading state
- one realistic edge case

That is usually more valuable than a high percentage number.

## Practical Rules

- Test behavior, not implementation trivia.
- Prefer one strong test over three repetitive ones.
- Keep tests near the code they verify.
- Name tests by business behavior, not function internals.
- When a bug is fixed, add a regression test for it.
- If a file is hard to test, that is often a design signal worth addressing.
