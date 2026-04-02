## Changesets Workflow

Use Changesets to manage Harbor's lockstep release version.

1. Run `pnpm changeset`
2. Describe the user-facing change and choose the version bump
3. Merge the pull request into `main`
4. Let the release workflow open or update the version PR
5. Merge the version PR and create the release tag, for example `v0.2.0`

The workspace packages in this repository release in lockstep:

- `@harbor/service`
- `@harbor/web`
- `@harbor/harbor-events`
