# Project-Local Skill Bridge Design

Date: 2026-03-12

## Summary

This document defines the formal design for making Harbor-managed Codex skills available inside a user project without modifying the global `~/.codex` home and without storing the real skill source inside the project repository.

The design uses a thin project-local bridge:

- Harbor owns the real skill source under `~/.harbor`
- The project exposes those skills through `{PROJECT_ROOT}/.codex/skills/...`
- The project-side entries are symlinks
- Codex authentication, sessions, and user config remain in the user's existing `~/.codex`

This is the preferred direction over replacing `HOME` or `CODEX_HOME`, because the current Codex local state bundles auth, config, sessions, and skills under the same home directory.

## Problem

Harbor wants to provide default workflow skills to Codex. Those skills should be:

- available automatically when Codex runs inside a project
- managed by Harbor rather than copied into each repository as real source
- isolated from the user's global Codex auth and session state
- removable and repairable on a per-project basis

At the same time, Harbor should avoid:

- modifying `~/.codex/auth.json`
- replacing the user's Codex home directory
- writing real Harbor workflow source into the repository
- polluting Git status with Harbor-generated bridge files

## Why Not Replace Codex Home

The current local Codex state under `~/.codex` contains at least:

- `auth.json`
- `config.toml`
- `sessions/`
- `skills/`

Because auth, config, and sessions live alongside skills, replacing the Codex home for Harbor tasks would risk:

- losing authentication
- breaking thread resume
- diverging user config from Harbor task behavior

For that reason, Harbor should keep the user's real Codex home stable and only project a Harbor-managed skill view into each project.

## Goals

- Make Harbor official skills discoverable from `{PROJECT_ROOT}/.codex/skills`
- Keep the real skill source outside the repository
- Avoid touching global `~/.codex` auth and session files
- Support project-level enable/disable and self-healing
- Keep the repository clean from Harbor bridge noise

## Non-Goals

- Replacing the user's global Codex configuration model
- Introducing per-task custom Codex homes
- Solving multi-profile skill isolation in the first version
- Defining the full Harbor skill authoring format

## Proposed Structure

### Harbor-owned source

Harbor stores the real skill source outside the project, scoped by project:

```text
~/.harbor/projects/{projectId}/skills/{skillName}/SKILL.md
~/.harbor/projects/{projectId}/skills/{skillName}/scripts/...
~/.harbor/projects/{projectId}/skills/{skillName}/assets/...
```

This directory is owned and updated by Harbor.

### Project-local bridge

Inside the project, Harbor creates a Codex-visible bridge:

```text
{PROJECT_ROOT}/.codex/skills/harbor-{skillName} -> ~/.harbor/projects/{projectId}/skills/{skillName}
```

Example:

```text
{PROJECT_ROOT}/.codex/skills/harbor-fix-tests -> ~/.harbor/projects/p_123/skills/fix-tests
{PROJECT_ROOT}/.codex/skills/harbor-review-diff -> ~/.harbor/projects/p_123/skills/review-diff
```

## Why Use Per-Skill Symlinks

The preferred shape is one symlink per skill, not a single nested Harbor folder such as:

```text
{PROJECT_ROOT}/.codex/skills/harbor -> ~/.harbor/projects/{projectId}/skills
```

Reasons:

- it does not assume Codex recursively scans nested subdirectories under `skills/`
- every linked entry is a direct child of `.codex/skills`
- Harbor-managed skills can coexist with user-created project-local skills
- install, uninstall, and repair operations are easier and more explicit

If future validation proves Codex recursively discovers nested skills safely, Harbor may support a single-folder bridge later. The first formal implementation should use direct per-skill links.

## Discovery Model

The discovery model is:

- Codex still runs with `workingDirectory = {PROJECT_ROOT}`
- Codex continues using the user's real `~/.codex` for auth, sessions, and config
- Codex sees Harbor-managed skills because they appear inside `{PROJECT_ROOT}/.codex/skills`

This preserves the existing Codex authentication model while giving Harbor project-scoped skill injection.

## Runtime Access Model

Skill discovery alone is not enough. A bridged skill may contain scripts, templates, or assets stored outside the project in `~/.harbor`.

Because the symlink target resolves outside the project root, Harbor must also ensure the executor can read the Harbor skill source at runtime.

Therefore, when Harbor official skills are enabled for a project, the task runtime policy must include:

```text
additionalDirectories += ~/.harbor/projects/{projectId}/skills
```

This keeps the model explicit:

- project bridge for Codex discovery
- `additionalDirectories` for runtime access permission

## Git Hygiene

The bridge lives inside the repository working tree, so Harbor must prevent Git noise.

Harbor should not modify `.gitignore`.

Instead, Harbor should write local excludes into:

```text
{PROJECT_ROOT}/.git/info/exclude
```

Recommended patterns:

```text
.codex/skills/harbor-*
```

This keeps Harbor bridge files out of normal `git status` output without changing repository-tracked ignore rules.

## Lifecycle

### Enable

When Harbor official skills are enabled for a project:

1. Ensure `~/.harbor/projects/{projectId}/skills/...` exists
2. Ensure `{PROJECT_ROOT}/.codex/skills/` exists
3. Create or repair per-skill symlinks
4. Ensure `.git/info/exclude` contains Harbor bridge patterns
5. Ensure task runtime policy includes the Harbor skill root in `additionalDirectories`

### Disable

When Harbor official skills are disabled for a project:

1. Remove Harbor-created symlinks from `{PROJECT_ROOT}/.codex/skills`
2. Remove Harbor-owned exclude entries from `.git/info/exclude`
3. Stop injecting the Harbor skill root into runtime policy
4. Keep the Harbor-owned source under `~/.harbor` unless explicit cleanup is requested

### Self-healing

Before task execution, Harbor should verify:

- the project bridge directory exists
- expected Harbor symlinks exist
- each symlink target still resolves correctly
- runtime policy still grants access to the Harbor skill root

If not, Harbor should repair the bridge automatically.

## Ownership Rules

Harbor only owns bridge entries that match its namespace:

```text
harbor-*
```

Harbor must not delete or rewrite:

- user-created project-local skills
- non-Harbor entries under `{PROJECT_ROOT}/.codex/skills`
- global `~/.codex/skills`

This namespace rule is important for coexistence and safe cleanup.

## Product Behavior

This feature should be modeled as a project-level capability, not as an unconditional side effect of importing a project.

Recommended behavior:

- project import does not immediately modify the repository
- Harbor creates the bridge when official skills are enabled for the project, or lazily on first Harbor-skill-backed task start
- the UI should clearly show whether Harbor official skills are enabled for the project

## Risks

### Skill discovery semantics may differ from expectation

The first implementation avoids nested directory assumptions by using direct per-skill links. This is the safest form.

### Symlink targets resolve outside the project

This is expected. It is why `additionalDirectories` must include the Harbor skill root.

### Some tools or environments may dislike symlinks

If an environment cannot tolerate symlinks, Harbor may need a fallback copy-based bridge. That fallback is not the primary design.

### Repository-local `.codex` may already exist

Harbor must merge safely:

- create `.codex/skills` only if missing
- never overwrite unrelated files
- only manage `harbor-*` entries

## Open Questions

- Does Codex definitely treat each direct child under `{PROJECT_ROOT}/.codex/skills` as a skill root in all supported versions
- Should Harbor create the bridge immediately when project skills are enabled, or lazily on first task start
- Should Harbor store a project-local manifest under `~/.harbor` to track expected skill links and versions

## Recommended First Implementation

The first formal implementation should use:

- project-scoped Harbor skill source under `~/.harbor/projects/{projectId}/skills`
- direct per-skill symlinks under `{PROJECT_ROOT}/.codex/skills/harbor-*`
- `.git/info/exclude` for local Git hygiene
- runtime policy `additionalDirectories` pointing at the Harbor project skill root
- bridge repair on task start

This gives Harbor project-level skill injection without changing the user's global Codex auth or session environment.
