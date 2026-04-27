---
name: harbor-cli
description: Use Harbor CLI inside a Harbor agent task to inspect task state, read or write project files, inspect git state, and create orchestration follow-up runs.
---

# Harbor CLI

Use this skill when you are running inside a Harbor-managed task and need to interact with Harbor state through the local CLI.

## What this skill assumes

- The `harbor` command is already available on `PATH`.
- Harbor auth is already configured for the current task environment.
- Current context is available through:
  - `HARBOR_PROJECT_ID`
  - `HARBOR_TASK_ID`
  - `HARBOR_ORCHESTRATION_ID`

## Preferred workflow

- Use the Harbor CLI instead of calling Harbor HTTP APIs directly.
- Prefer current-context env vars instead of hard-coding ids.
- Use Harbor CLI for Harbor metadata, orchestration, files, and git actions.

## Common commands

Identify current auth context:

```bash
harbor auth whoami
```

Inspect the current task:

```bash
harbor task get --id "$HARBOR_TASK_ID"
harbor task events --id "$HARBOR_TASK_ID" --limit 100
```

Update the current task title:

```bash
harbor task title set --id "$HARBOR_TASK_ID" --title "Short task title"
```

Read or write project files:

```bash
harbor files list --project "$HARBOR_PROJECT_ID"
harbor files read --project "$HARBOR_PROJECT_ID" --path "README.md"
harbor files write --project "$HARBOR_PROJECT_ID" --path "notes/status.md" --content-file "./status.md" --create-parents
```

Inspect git state:

```bash
harbor git summary --project "$HARBOR_PROJECT_ID"
harbor git branches --project "$HARBOR_PROJECT_ID"
harbor git diff --project "$HARBOR_PROJECT_ID"
```

Create a follow-up task in the current orchestration:

```bash
harbor orchestration task create \
  --id "$HARBOR_ORCHESTRATION_ID" \
  --prompt "Continue from the latest repo state." \
  --executor codex \
  --model gpt-5.4 \
  --mode connected \
  --effort medium
```

Bootstrap a new orchestration:

```bash
harbor orchestration bootstrap \
  --project "$HARBOR_PROJECT_ID" \
  --prompt "Start a new maintenance run." \
  --executor codex \
  --model gpt-5.4 \
  --mode connected \
  --effort medium
```

## Notes

- Use `--item-text`, `--item-file`, and `--item-image` when a follow-up run needs structured task input.
- Prefer `--content-file` over long inline strings when writing large files.
- Keep Harbor-specific operations inside the CLI so auth and routing stay consistent.
