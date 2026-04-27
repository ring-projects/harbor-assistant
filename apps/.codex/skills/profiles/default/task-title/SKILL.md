---
name: harbor-task-title
description: Use this skill at the start of a Harbor Codex task to set a short, human-readable task title when the raw user prompt is too long, noisy, or ambiguous for the task list.
---

# Harbor Task Title

Use this skill once near the start of a Harbor task when a clearer task title would help the task list or history view.

## What this skill does

- proposes a concise title for the current task
- updates Harbor task metadata through the local Harbor service
- keeps the task list readable without changing the user's original prompt

## When to use it

Use this skill when:

- the user prompt is long or multi-step
- the first line of the prompt is not a good summary
- the task should be grouped under a clearer action-oriented label

Do not use this skill when:

- the existing title is already short and clear
- you would need to expose secrets, file paths, or private data in the title
- you are about to rename the task repeatedly without new information

## Title rules

- Keep the title between 4 and 10 words when possible.
- Prefer an action + object summary.
- Do not include code fences, quotes, paths, stack traces, or credentials.
- Do not mention Harbor, Codex, or Claude unless the task is specifically about them.
- Update the title at most once unless the original summary was clearly wrong.

## How to update the title

Run:

```bash
node .codex/skills/task-title/scripts/set-task-title.mjs "Short task title"
```

## Examples

- "Refactor task runtime policy plumbing"
- "Add Harbor skill bridge cleanup tests"
- "Debug missing web search events"
