# Codex MCP Config Research (MVP)

Last verified: 2026-02-20

## Goal

Document how to resolve Codex MCP configuration in our Next.js project with correct path precedence.

## Confirmed sources

- Codex config basics: https://developers.openai.com/codex/config-basic
- Codex config reference: https://developers.openai.com/codex/config-reference
- Codex MCP docs: https://developers.openai.com/codex/mcp

## Key findings

1. Codex user-level config file is `~/.codex/config.toml`.
2. Project-level config file is `.codex/config.toml`.
3. MCP servers are configured under `[mcp_servers.<name>]` in `config.toml`.
4. Effective config uses layered precedence (high to low):
   - Command-line arguments (for example `-c`)
   - Profile values (`--profile`)
   - Project config (`.codex/config.toml`, trusted project only)
   - User config (`~/.codex/config.toml`)
   - System config (`/etc/codex/config.toml`)
   - Built-in defaults

## What this means for our implementation

1. We should stop scanning `config.json` and `mcp.json` for Codex MCP.
2. For Codex MCP support, read only `config.toml` layers.
3. Build a resolver that returns:
   - merged MCP server map
   - source metadata per server (`project` or `user`)
   - diagnostics (parse errors, missing files, trust skipped)
4. Keep sensitive values (for example env tokens) out of UI responses by default.

## Proposed MVP behavior

1. Resolve candidate files:
   - User: `~/.codex/config.toml`
   - Project: `<repo>/.codex/config.toml`
2. Parse TOML from both files (if present).
3. Extract only `[mcp_servers.*]` sections.
4. Merge with project overriding user for same server key.
5. Return a typed result:
   - `servers`
   - `source`
   - `diagnostics`

## Suggested types

```ts
type McpServerConfig = {
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  enabled?: boolean
}

type ResolvedMcp = {
  servers: Record<string, McpServerConfig & { source: "user" | "project" }>
  diagnostics: Array<{
    level: "info" | "warn" | "error"
    code: string
    message: string
    file?: string
  }>
}
```

## Integration plan (next step)

1. Add `src/services/codex-mcp/config.service.ts`.
2. Add `src/services/codex-mcp/types.ts`.
3. Add a server action to fetch resolved MCP config.
4. Add a minimal UI panel for debug/inspection.

## Notes

- If project trust status is unavailable in-app, treat project config as opt-in with a feature flag first.
- Keep parser failures non-fatal; return diagnostics instead of throwing.
